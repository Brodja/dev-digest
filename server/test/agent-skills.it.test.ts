import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

/**
 * Agent ↔ skill links (server/specs/002-skills.md): PUT replaces the ordered
 * set with per-agent `enabled`; 422 for duplicates / foreign skills; the legacy
 * POST keeps `enabled`; agent version snapshots list enabled links only.
 */
d('agent skill links (Testcontainers pg)', () => {
  let pg: PgFixture;
  let seq = 0;

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

  async function newAgent(app: App) {
    return (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: `Agent ${seq++}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'review' },
      })
    ).json() as { id: string };
  }

  async function newSkill(app: App) {
    return (
      await app.inject({
        method: 'POST',
        url: '/skills',
        payload: { name: `link-skill-${seq++}`, description: 'Do X.', type: 'custom', body: 'rules' },
      })
    ).json() as { id: string };
  }

  const put = (app: App, agentId: string, links: { skill_id: string; enabled: boolean }[]) =>
    app.inject({ method: 'PUT', url: `/agents/${agentId}/skills`, payload: { links } });

  it('PUT replaces the ordered set with per-agent enabled; GET returns it in order', async () => {
    const app = await makeApp();
    const agent = await newAgent(app);
    const [s1, s2, s3] = [await newSkill(app), await newSkill(app), await newSkill(app)];

    const res = await put(app, agent.id, [
      { skill_id: s3!.id, enabled: true },
      { skill_id: s1!.id, enabled: false },
      { skill_id: s2!.id, enabled: true },
    ]);
    expect(res.statusCode).toBe(200);
    const expected = [
      { agent_id: agent.id, skill_id: s3!.id, order: 0, enabled: true },
      { agent_id: agent.id, skill_id: s1!.id, order: 1, enabled: false },
      { agent_id: agent.id, skill_id: s2!.id, order: 2, enabled: true },
    ];
    expect(res.json()).toEqual(expected);
    expect((await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })).json()).toEqual(expected);

    // Reorder + drop one: the dropped skill is unlinked.
    const next = await put(app, agent.id, [
      { skill_id: s2!.id, enabled: false },
      { skill_id: s3!.id, enabled: true },
    ]);
    expect(next.json()).toEqual([
      { agent_id: agent.id, skill_id: s2!.id, order: 0, enabled: false },
      { agent_id: agent.id, skill_id: s3!.id, order: 1, enabled: true },
    ]);

    expect((await put(app, agent.id, [])).json()).toEqual([]);
    await app.close();
  });

  it('rejects duplicates and foreign / unknown skills with 422; unknown agent → 404', async () => {
    const app = await makeApp();
    const agent = await newAgent(app);
    const s1 = await newSkill(app);

    const dup = await put(app, agent.id, [
      { skill_id: s1.id, enabled: true },
      { skill_id: s1.id, enabled: false },
    ]);
    expect(dup.statusCode).toBe(422);
    expect(dup.json().error.details).toEqual({ duplicate_skill_ids: [s1.id] });

    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'other-links-ws' }).returning();
    const [foreign] = await pg.handle.db
      .insert(t.skills)
      .values({ workspaceId: otherWs!.id, name: 'foreign', description: 'd', type: 'custom', source: 'manual', body: 'b' })
      .returning();
    const cross = await put(app, agent.id, [{ skill_id: foreign!.id, enabled: true }]);
    expect(cross.statusCode).toBe(422);
    expect(cross.json().error.details).toEqual({ unknown_skill_ids: [foreign!.id] });

    // The same rule guards the legacy single-link POST.
    const legacy = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_id: foreign!.id },
    });
    expect(legacy.statusCode).toBe(422);

    // Nothing was written by the rejected calls.
    expect((await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })).json()).toEqual([]);

    const missing = await put(app, '00000000-0000-4000-8000-000000000000', []);
    expect(missing.statusCode).toBe(404);
    const badUuid = await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: { links: [{ skill_id: 'not-a-uuid', enabled: true }] },
    });
    expect(badUuid.statusCode).toBe(422);
    await app.close();
  });

  it('legacy POST { skill_ids } reorders and keeps each link enabled flag', async () => {
    const app = await makeApp();
    const agent = await newAgent(app);
    const [s1, s2, s3] = [await newSkill(app), await newSkill(app), await newSkill(app)];
    await put(app, agent.id, [
      { skill_id: s1!.id, enabled: true },
      { skill_id: s2!.id, enabled: false },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [s2!.id, s3!.id, s1!.id] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { agent_id: agent.id, skill_id: s2!.id, order: 0, enabled: false },
      { agent_id: agent.id, skill_id: s3!.id, order: 1, enabled: true },
      { agent_id: agent.id, skill_id: s1!.id, order: 2, enabled: true },
    ]);
    await app.close();
  });

  it('an agent version snapshot lists only the enabled links, in order', async () => {
    const app = await makeApp();
    const agent = await newAgent(app);
    const [s1, s2, s3] = [await newSkill(app), await newSkill(app), await newSkill(app)];
    await put(app, agent.id, [
      { skill_id: s3!.id, enabled: true },
      { skill_id: s1!.id, enabled: false },
      { skill_id: s2!.id, enabled: true },
    ]);

    // A config change snapshots v2 with the current links.
    await app.inject({ method: 'PUT', url: `/agents/${agent.id}`, payload: { system_prompt: 'review v2' } });
    const [latest] = (await app.inject({ method: 'GET', url: `/agents/${agent.id}/versions` })).json();
    expect(latest.version).toBe(2);
    expect(latest.config.skills).toEqual([s3!.id, s2!.id]);
    await app.close();
  });
});
