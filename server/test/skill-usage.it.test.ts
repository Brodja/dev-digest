import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

/**
 * Skill usage on the list card and the Stats tab (client/specs/004):
 * GET /skills → used_by_count, pull_rate, accept_rate; GET /skills/:id/stats → the same rates.
 * Runs, traces, reviews and findings are written straight to the DB — no LLM.
 */
d('skill usage: agents, pull rate, accept rate (Testcontainers pg)', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }
  type App = Awaited<ReturnType<typeof makeApp>>;

  async function newSkill(app: App, name: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name, description: 'Do X.', type: 'custom', body: 'rules' },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
  }

  /** A review run of `workspaceId`; `skills` = config.skills of its trace (null → no trace). */
  async function run(workspaceId: string, skills: string[] | 'old-trace' | null) {
    const db = pg.handle.db;
    const [r] = await db.insert(t.agentRuns).values({ workspaceId, status: 'done' }).returning();
    if (skills === 'old-trace') {
      await db.insert(t.runTraces).values({ runId: r!.id, trace: { config: { agent: 'x', model: 'm' } } });
    } else if (skills) {
      const trace = {
        config: { agent: 'x', model: 'm', skills: skills.map((id) => ({ id, name: id, version: 1, trusted: true, tokens: 1 })) },
      };
      await db.insert(t.runTraces).values({ runId: r!.id, trace });
    }
    return r!.id;
  }

  /** A review of `runId` with findings: 'a' accepted, 'd' dismissed, '-' undecided. */
  async function findings(workspaceId: string, prId: string, runId: string, states: string) {
    const db = pg.handle.db;
    const [rv] = await db.insert(t.reviews).values({ workspaceId, prId, runId, kind: 'review' }).returning();
    const now = new Date();
    for (const st of states) {
      await db.insert(t.findings).values({
        reviewId: rv!.id,
        file: 'a.ts',
        startLine: 1,
        endLine: 1,
        severity: 'WARNING',
        category: 'bug',
        title: 't',
        rationale: 'r',
        confidence: 0.9,
        acceptedAt: st === 'a' ? now : null,
        dismissedAt: st === 'd' ? now : null,
      });
    }
  }

  it('counts linking agents, the runs that sent each skill and the decided findings of those runs — per workspace', async () => {
    const app = await makeApp();
    const db = pg.handle.db;
    const a = await newSkill(app, 'usage-a');
    const b = await newSkill(app, 'usage-b');
    const c = await newSkill(app, 'usage-c');
    const [row] = await db.select({ ws: t.skills.workspaceId }).from(t.skills).where(eq(t.skills.id, a.id));
    const ws = row!.ws;
    const [pr] = await db.select({ id: t.pullRequests.id }).from(t.pullRequests).where(eq(t.pullRequests.workspaceId, ws)).limit(1);

    // Links: a on, b switched off — both count as "used by".
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Usage Agent', provider: 'openai', model: 'gpt-4.1', system_prompt: 'review' },
      })
    ).json() as { id: string };
    await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: { links: [{ skill_id: a.id, enabled: true }, { skill_id: b.id, enabled: false }] },
    });

    // Traced runs before this test (seed): the denominator starts there.
    const [base] = await db
      .select({ n: count() })
      .from(t.runTraces)
      .innerJoin(t.agentRuns, eq(t.agentRuns.id, t.runTraces.runId))
      .where(eq(t.agentRuns.workspaceId, ws));
    const total = Number(base!.n) + 3;

    const r1 = await run(ws, [a.id]);
    const r2 = await run(ws, [a.id, b.id]);
    await run(ws, 'old-trace'); // counts in the denominator, sends nothing
    const noTrace = await run(ws, null); // no trace → not counted at all
    await findings(ws, pr!.id, r1, 'aad-');
    await findings(ws, pr!.id, r2, 'd');
    await findings(ws, pr!.id, noTrace, 'aaaa');

    // Another workspace: its agent links `a`, its run sends `a`, its findings are accepted — none of it counts.
    const [other] = await db.insert(t.workspaces).values({ name: 'usage-other-ws' }).returning();
    const [otherAgent] = await db
      .insert(t.agents)
      .values({ workspaceId: other!.id, name: 'Other', provider: 'openai', model: 'gpt-4.1', systemPrompt: 'x' })
      .returning();
    await db.insert(t.agentSkills).values({ agentId: otherAgent!.id, skillId: a.id, order: 0 });
    const otherRun = await run(other!.id, [a.id]);
    await findings(other!.id, pr!.id, otherRun, 'aaa');
    const [foreign] = await db
      .insert(t.skills)
      .values({ workspaceId: other!.id, name: 'usage-foreign', description: 'd', type: 'custom', source: 'manual', body: 'b' })
      .returning();

    const res = await app.inject({ method: 'GET', url: '/skills' });
    expect(res.statusCode).toBe(200);
    const list = res.json() as { id: string; used_by_count: number; pull_rate: number | null; accept_rate: number | null }[];
    const byId = new Map(list.map((s) => [s.id, s]));
    expect(byId.has(foreign!.id)).toBe(false);

    // a: sent by r1 + r2; findings 2 accepted / 2 dismissed (the undecided one does not count).
    expect(byId.get(a.id)).toMatchObject({ used_by_count: 1, pull_rate: 2 / total, accept_rate: 0.5 });
    // b: sent by r2 only; one dismissed finding → 0%.
    expect(byId.get(b.id)).toMatchObject({ used_by_count: 1, pull_rate: 1 / total, accept_rate: 0 });
    // c: never linked, never sent: a real 0% pull, no accept rate.
    expect(byId.get(c.id)).toMatchObject({ used_by_count: 0, pull_rate: 0, accept_rate: null });

    // The Stats tab carries the same rates.
    const stats = (await app.inject({ method: 'GET', url: `/skills/${a.id}/stats` })).json();
    expect(stats).toMatchObject({ used_by_count: 1, pull_rate: 2 / total, accept_rate: 0.5 });
    await app.close();
  });
});
