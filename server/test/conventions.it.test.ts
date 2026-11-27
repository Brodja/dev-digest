import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockEmbedder, MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type {
  ChatMessage,
  ConventionCandidate,
  ConventionsState,
  Review,
  RunTrace,
  Skill,
  StructuredRequest,
  StructuredResult,
} from '@devdigest/shared';
import {
  FILES,
  FIRST_SCAN,
  HEAD,
  NOT_FOUND_RULE,
  PLUGIN_RULE,
  RESCAN,
  ROUTES_PATH,
  SAMPLE_PATHS,
  SERVICE_PATH,
  STRICT_RULE,
  TYPE_PROVIDER_RULE,
} from './helpers/conventions-fixture.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

/**
 * Conventions extractor end to end over HTTP (server/specs/003-conventions.md):
 * real Postgres, the real repo-intel sampler over file_rank rows, the mock LLM
 * and git client. One model call per scan; evidence grounded by code; re-scan
 * keeps decisions; the skill is saved as convention/extracted and reaches the
 * run trace once linked to an agent.
 */

const CLEAN: Review = { verdict: 'approve', summary: 'ok', score: 100, findings: [] };
const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

class ThrowingLLM extends MockLLMProvider {
  override async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    this.calls.push({ method: 'completeStructured', req });
    throw new Error('upstream 503');
  }
}

d('conventions extractor (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function appWith(llm: MockLLMProvider) {
    return buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test', REPO_INTEL_ENABLED: 'true' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ files: FILES, head: HEAD, diff: DIFF }),
        llm: { openai: llm },
      },
    });
  }
  type App = Awaited<ReturnType<typeof appWith>>;

  const scanLlm = (fixture: unknown) =>
    new MockLLMProvider('openai', { structured: CLEAN, structuredBySchema: { ConventionExtraction: fixture } });

  /** A repo with a clone and (unless `ranked: false`) file_rank rows for the samples + a test file. */
  async function newRepo(opts: { ranked?: boolean; cloned?: boolean; workspace?: string } = {}) {
    const db = pg.handle.db;
    const name = `conv-repo-${seq++}`;
    const [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId: opts.workspace ?? workspaceId,
        owner: 'acme',
        name,
        fullName: `acme/${name}`,
        clonePath: opts.cloned === false ? null : `/clones/acme/${name}`,
      })
      .returning();
    if (opts.ranked !== false) {
      const ranked = ['src/modules/users/service.test.ts', ...SAMPLE_PATHS]; // the test file ranks first and is filtered
      await db.insert(t.fileRank).values(
        ranked.map((filePath, i) => ({
          repoId: repo!.id,
          filePath,
          pagerank: 1 - i / 10,
          hotness: 0,
          rank: 1 - i / 10,
          percentile: 99 - i,
        })),
      );
    }
    return repo!;
  }

  const getState = async (app: App, repoId: string) => {
    const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(res.statusCode).toBe(200);
    return res.json() as ConventionsState;
  };
  const extract = (app: App, repoId: string) => app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
  const patch = (app: App, repoId: string, id: string, payload: unknown) =>
    app.inject({ method: 'PATCH', url: `/repos/${repoId}/conventions/${id}`, payload: payload as object });
  const byRule = (s: ConventionsState, rule: string) => s.candidates.find((c) => c.rule === rule) as ConventionCandidate;
  const structuredCalls = (llm: MockLLMProvider) => llm.calls.filter((c) => c.method === 'completeStructured');

  it('shows an empty state before the first scan', async () => {
    const app = await appWith(scanLlm(FIRST_SCAN));
    const repo = await newRepo();
    expect(await getState(app, repo.id)).toEqual({ scan: null, candidates: [] });
    await app.close();
  });

  it('extracts: code-picked files, one model call, candidates grounded by code', async () => {
    const llm = scanLlm(FIRST_SCAN);
    const app = await appWith(llm);
    const repo = await newRepo();

    const res = await extract(app, repo.id);
    expect(res.statusCode, res.body).toBe(200);
    const state = res.json() as ConventionsState;

    const calls = structuredCalls(llm);
    expect(calls).toHaveLength(1);
    const req = calls[0]!.req as StructuredRequest<unknown> & { messages: ChatMessage[] };
    expect(req.schemaName).toBe('ConventionExtraction');
    expect(req.model).toBe('gpt-5.4'); // FEATURE_MODELS default for conventions
    expect(req.messages[1]!.content).not.toContain('service.test.ts');

    expect(state.scan).toMatchObject({
      status: 'succeeded',
      provider: 'openai',
      model: 'gpt-5.4',
      commit_sha: HEAD,
      files: ['tsconfig.json', ...SAMPLE_PATHS],
      proposed: 6,
      kept: 3,
      dropped_ungrounded: 3,
      dropped_duplicate: 0,
      error_code: null,
    });
    expect(state.candidates.map((c) => [c.rule, c.evidence_path, c.evidence_start_line, c.evidence_end_line])).toEqual([
      [NOT_FOUND_RULE, SERVICE_PATH, 8, 9],
      [STRICT_RULE, 'tsconfig.json', 3, 4],
      [PLUGIN_RULE, ROUTES_PATH, 5, 5],
    ]);
    const nf = byRule(state, NOT_FOUND_RULE);
    expect(nf).toMatchObject({ status: 'pending', accepted: false, commit_sha: HEAD, confidence: 0.9 });
    expect(nf.evidence_snippet).toBe(
      "    const user = await this.repo.findById(id);\n    if (!user) throw new NotFoundError('User not found');",
    );
    expect(byRule(state, STRICT_RULE).confidence).toBe(0.85);
    expect(await getState(app, repo.id)).toEqual(state);
    await app.close();
  });

  it('accept / reject / edit; re-scan keeps decisions, replaces pending and does not duplicate', async () => {
    const app = await appWith(scanLlm(FIRST_SCAN));
    const repo = await newRepo();
    const first = (await extract(app, repo.id)).json() as ConventionsState;
    const nf = byRule(first, NOT_FOUND_RULE);
    const strict = byRule(first, STRICT_RULE);

    const acc = await patch(app, repo.id, nf.id, { status: 'accepted' });
    expect(acc.statusCode).toBe(200);
    expect(acc.json()).toMatchObject({ status: 'accepted', accepted: true });
    expect((await patch(app, repo.id, strict.id, { status: 'rejected' })).json()).toMatchObject({
      status: 'rejected',
      accepted: false,
    });
    const editedRule = 'Throw NotFoundError from services when an entity is missing; never return null.';
    const edited = await patch(app, repo.id, nf.id, { rule: `  ${editedRule}  ` });
    expect(edited.json()).toMatchObject({ rule: editedRule, status: 'accepted' });

    // Bad input.
    expect((await patch(app, repo.id, '00000000-0000-4000-8000-000000000000', { status: 'accepted' })).statusCode).toBe(404);
    expect((await patch(app, repo.id, nf.id, {})).statusCode).toBe(422);
    expect((await patch(app, repo.id, nf.id, { rule: '   ' })).statusCode).toBe(422);
    expect((await app.inject({ method: 'GET', url: '/repos/not-a-uuid/conventions' })).statusCode).toBe(422);
    await app.close();

    // Re-scan with a model that re-proposes the accepted and the rejected rule.
    const llm2 = scanLlm(RESCAN);
    const app2 = await appWith(llm2);
    const res = await extract(app2, repo.id);
    expect(res.statusCode, res.body).toBe(200);
    const second = res.json() as ConventionsState;
    // The decided rules were in the prompt as "do not propose again".
    const user = (structuredCalls(llm2)[0]!.req as { messages: ChatMessage[] }).messages[1]!.content;
    expect(user).toContain(`- ${editedRule}`);
    expect(user).toContain(`- ${STRICT_RULE}`);

    expect(second.scan).toMatchObject({ proposed: 3, kept: 1, dropped_duplicate: 2 });
    expect(second.candidates.map((c) => [c.rule, c.status])).toEqual([
      [TYPE_PROVIDER_RULE, 'pending'], // new; the old pending PLUGIN_RULE is gone
      [editedRule, 'accepted'],
      [STRICT_RULE, 'rejected'],
    ]);
    expect(byRule(second, editedRule).id).toBe(nf.id);
    await app2.close();
  });

  it('a failed model call → 502 llm_failed, stored as a failed scan, nothing deleted', async () => {
    const app = await appWith(scanLlm(FIRST_SCAN));
    const repo = await newRepo();
    await extract(app, repo.id);
    await app.close();

    const app2 = await appWith(new ThrowingLLM('openai', { structured: CLEAN }));
    const res = await extract(app2, repo.id);
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('llm_failed');
    const state = await getState(app2, repo.id);
    expect(state.scan).toMatchObject({ status: 'failed', error_code: 'llm_failed', files: ['tsconfig.json', ...SAMPLE_PATHS] });
    expect(state.scan!.error_message).toContain('upstream 503');
    expect(state.candidates).toHaveLength(3);
    await app2.close();
  });

  it('precondition errors are clear and stored (no index, no clone); other workspaces get 404', async () => {
    const llm = scanLlm(FIRST_SCAN);
    const app = await appWith(llm);

    const unindexed = await newRepo({ ranked: false });
    const res = await extract(app, unindexed.id);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('repo_not_indexed');
    expect((await getState(app, unindexed.id)).scan).toMatchObject({ status: 'failed', error_code: 'repo_not_indexed' });

    const uncloned = await newRepo({ cloned: false });
    const res2 = await extract(app, uncloned.id);
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error.code).toBe('repo_not_cloned');
    expect(structuredCalls(llm)).toHaveLength(0);

    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'other' }).returning();
    const foreign = await newRepo({ workspace: otherWs!.id });
    expect((await app.inject({ method: 'GET', url: `/repos/${foreign.id}/conventions` })).statusCode).toBe(404);
    expect((await extract(app, foreign.id)).statusCode).toBe(404);
    await app.close();
  });

  it('uses the workspace’s feature model for conventions', async () => {
    const llm = scanLlm(FIRST_SCAN);
    const app = await appWith(llm);
    const repo = await newRepo();
    const put = await app.inject({
      method: 'PUT',
      url: '/settings',
      payload: { feature_models: { conventions: { provider: 'openai', model: 'cheap-model' } } },
    });
    expect(put.statusCode).toBe(200);
    try {
      expect((await extract(app, repo.id)).statusCode).toBe(200);
      expect((structuredCalls(llm)[0]!.req as { model: string }).model).toBe('cheap-model');
      expect((await getState(app, repo.id)).scan?.model).toBe('cheap-model');
    } finally {
      await app.inject({ method: 'PUT', url: '/settings', payload: { feature_models: {} } });
      await app.close();
    }
  });

  it('builds the skill from accepted conventions only, and the skill reaches the run trace', async () => {
    const llm = scanLlm(FIRST_SCAN);
    const app = await appWith(llm);
    const repo = await newRepo();
    const state = (await extract(app, repo.id)).json() as ConventionsState;
    const nf = byRule(state, NOT_FOUND_RULE);
    const strict = byRule(state, STRICT_RULE);
    const plugin = byRule(state, PLUGIN_RULE);
    await patch(app, repo.id, nf.id, { status: 'accepted' });
    await patch(app, repo.id, plugin.id, { status: 'accepted' });
    await patch(app, repo.id, strict.id, { status: 'rejected' });

    const body = `# repo-conventions\n\nFlag changes that break these rules.\n\n- ${NOT_FOUND_RULE} (\`${SERVICE_PATH}:L8-L9\`)\n- ${PLUGIN_RULE} (\`${ROUTES_PATH}:L5\`)`;
    const skillReq = (ids: string[], name = 'repo-conventions', extra: Record<string, unknown> = {}) =>
      app.inject({
        method: 'POST',
        url: `/repos/${repo.id}/conventions/skill`,
        payload: { name, description: 'Flag changes that break the house conventions.', body, convention_ids: ids, ...extra },
      });

    // A rejected or unknown id is refused.
    const bad = await skillReq([nf.id, strict.id]);
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error).toMatchObject({ code: 'conventions_not_accepted', details: { ids: [strict.id] } });
    expect((await skillReq([nf.id, nf.id])).statusCode).toBe(422); // duplicate ids

    const created = await skillReq([nf.id, plugin.id]);
    expect(created.statusCode, created.body).toBe(201);
    const skill = created.json() as Skill;
    expect(skill).toMatchObject({ name: 'repo-conventions', type: 'convention', source: 'extracted', trusted: true, enabled: true, version: 1 });
    expect((await skillReq([nf.id], 'repo-conventions')).json().error.code).toBe('skill_name_taken');

    // `enabled` is optional (client/specs/004): false → the skill starts disabled; not a boolean → 422.
    const off = await skillReq([plugin.id], 'repo-conventions-2', { enabled: false });
    expect(off.statusCode, off.body).toBe(201);
    expect(off.json()).toMatchObject({ name: 'repo-conventions-2', enabled: false, source: 'extracted', type: 'convention' });
    expect((await skillReq([plugin.id], 'repo-conventions-3', { enabled: 'no' })).statusCode).toBe(422);

    // Link to an agent, run a review: the skill is in the prompt (not wrapped) and in the trace.
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Conventions Reviewer', provider: 'openai', model: 'gpt-4.1', system_prompt: 'You review.' },
      })
    ).json() as { id: string };
    const linked = await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: { links: [{ skill_id: skill.id, enabled: true }] },
    });
    expect(linked.statusCode).toBe(200);

    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo.id,
        number: 1,
        title: 'Add config',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: 'abc123',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
    });
    const run = await app.inject({ method: 'POST', url: `/pulls/${pr!.id}/review`, payload: { agentId: agent.id } });
    expect(run.statusCode).toBe(200);
    const runId = run.json().runs[0].run_id as string;
    const [done] = await waitForPrRuns(pg.handle.db, pr!.id, { expected: 1 });
    expect(done!.status, done!.error ?? '').toBe('done');
    let traceRes = await app.inject({ method: 'GET', url: `/runs/${runId}/trace` });
    for (let i = 0; traceRes.statusCode === 404 && i < 200; i++) {
      await new Promise((r) => setTimeout(r, 25));
      traceRes = await app.inject({ method: 'GET', url: `/runs/${runId}/trace` });
    }
    expect(traceRes.statusCode).toBe(200);
    const trace = traceRes.json() as RunTrace;
    expect(trace.config.skills).toEqual([
      { id: skill.id, name: 'repo-conventions', version: 1, trusted: true, tokens: expect.any(Number) },
    ]);
    const review = structuredCalls(llm).at(-1)!.req as { schemaName: string; messages: ChatMessage[] };
    expect(review.schemaName).toBe('Review');
    const user = review.messages[1]!.content;
    expect(user).toContain('### repo-conventions');
    expect(user).toContain(NOT_FOUND_RULE);
    expect(user).not.toContain(STRICT_RULE);
    expect(user).not.toContain('<untrusted source="skill:repo-conventions"');
    await app.close();
  });
});
