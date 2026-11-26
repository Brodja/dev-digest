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
 * Skill history and usage (client/specs/004-skills-lab-design.md):
 * GET /skills/:id/versions, POST /skills/:id/restore, GET /skills/:id/stats.
 */
d('skill versions, restore and stats (Testcontainers pg)', () => {
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

  async function newSkill(app: App, body = 'v1 body') {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name: `history-${seq++}`, description: 'Do X.', type: 'custom', body },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  async function newAgent(app: App, name: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name, provider: 'openai', model: 'gpt-4.1', system_prompt: 'review' },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
  }

  const edit = (app: App, id: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'PUT', url: `/skills/${id}`, payload });

  const versions = async (app: App, id: string) =>
    (await app.inject({ method: 'GET', url: `/skills/${id}/versions` })).json() as {
      skill_id: string;
      version: number;
      body: string;
      created_at: string;
    }[];

  it('lists body versions newest first; a metadata-only edit adds none', async () => {
    const app = await makeApp();
    const skill = await newSkill(app);
    await edit(app, skill.id, { body: 'v2 body' });
    await edit(app, skill.id, { description: 'Do Y.', enabled: false });
    await edit(app, skill.id, { body: 'v3 body' });

    const list = await versions(app, skill.id);
    expect(list.map((v) => [v.version, v.body])).toEqual([
      [3, 'v3 body'],
      [2, 'v2 body'],
      [1, 'v1 body'],
    ]);
    expect(list[0]!.skill_id).toBe(skill.id);
    expect(Number.isNaN(Date.parse(list[0]!.created_at))).toBe(false);
    await app.close();
  });

  it('restore makes an old body the next version; the same body adds none', async () => {
    const app = await makeApp();
    const skill = await newSkill(app);
    await edit(app, skill.id, { body: 'v2 body' });

    const restored = await app.inject({ method: 'POST', url: `/skills/${skill.id}/restore`, payload: { version: 1 } });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ id: skill.id, version: 3, body: 'v1 body' });

    // v1's body is the current one now: restoring it again changes nothing.
    const again = await app.inject({ method: 'POST', url: `/skills/${skill.id}/restore`, payload: { version: 1 } });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ version: 3, body: 'v1 body' });

    expect((await versions(app, skill.id)).map((v) => [v.version, v.body])).toEqual([
      [3, 'v1 body'],
      [2, 'v2 body'],
      [1, 'v1 body'],
    ]);
    await app.close();
  });

  it('restore: unknown version → 404; bad id or version → 422', async () => {
    const app = await makeApp();
    const skill = await newSkill(app);
    const missing = await app.inject({ method: 'POST', url: `/skills/${skill.id}/restore`, payload: { version: 9 } });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('not_found');

    for (const version of [0, -1, 1.5, '1']) {
      const res = await app.inject({ method: 'POST', url: `/skills/${skill.id}/restore`, payload: { version } });
      expect(res.statusCode, `version ${String(version)}`).toBe(422);
    }
    expect((await app.inject({ method: 'GET', url: '/skills/not-a-uuid/versions' })).statusCode).toBe(422);
    expect((await app.inject({ method: 'GET', url: '/skills/not-a-uuid/stats' })).statusCode).toBe(422);
    await app.close();
  });

  it('stats: agents by name with their link state and place; in_prompt follows the run rule', async () => {
    const app = await makeApp();
    const skill = await newSkill(app);
    const other = await newSkill(app);
    await edit(app, skill.id, { body: 'v2 body' });
    const beta = await newAgent(app, `Beta ${seq++}`);
    const alpha = await newAgent(app, `Alpha ${seq++}`);
    await app.inject({
      method: 'PUT',
      url: `/agents/${alpha.id}/skills`,
      payload: {
        links: [
          { skill_id: other.id, enabled: true },
          { skill_id: skill.id, enabled: true },
        ],
      },
    });
    await app.inject({
      method: 'PUT',
      url: `/agents/${beta.id}/skills`,
      payload: { links: [{ skill_id: skill.id, enabled: false }] },
    });

    const res = await app.inject({ method: 'GET', url: `/skills/${skill.id}/stats` });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats).toMatchObject({
      skill_id: skill.id,
      version: 2,
      version_count: 2,
      used_by_count: 2,
      in_prompt_count: 1,
    });
    expect(stats.agents).toEqual([
      expect.objectContaining({ agent_id: alpha.id, link_enabled: true, position: 2, in_prompt: true, agent_enabled: true }),
      expect.objectContaining({ agent_id: beta.id, link_enabled: false, position: 1, in_prompt: false }),
    ]);

    // A globally disabled skill reaches no prompt, whatever the links say.
    await edit(app, skill.id, { enabled: false });
    const off = (await app.inject({ method: 'GET', url: `/skills/${skill.id}/stats` })).json();
    expect(off.in_prompt_count).toBe(0);

    // A skill nobody links.
    const lonely = (await app.inject({ method: 'GET', url: `/skills/${other.id}/stats` })).json();
    expect(lonely).toMatchObject({ used_by_count: 1, version_count: 1 });
    const unused = await newSkill(app);
    expect((await app.inject({ method: 'GET', url: `/skills/${unused.id}/stats` })).json()).toMatchObject({
      used_by_count: 0,
      in_prompt_count: 0,
      agents: [],
    });
    await app.close();
  });

  it("does not expose another workspace's skill (404 on versions / restore / stats)", async () => {
    const app = await makeApp();
    const db = pg.handle.db;
    const [otherWs] = await db.insert(t.workspaces).values({ name: 'other-history-ws' }).returning();
    const [foreign] = await db
      .insert(t.skills)
      .values({ workspaceId: otherWs!.id, name: 'foreign-history', description: 'd', type: 'custom', source: 'manual', body: 'b' })
      .returning();
    await db.insert(t.skillVersions).values({ skillId: foreign!.id, version: 1, body: 'b' });

    expect((await app.inject({ method: 'GET', url: `/skills/${foreign!.id}/versions` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'POST', url: `/skills/${foreign!.id}/restore`, payload: { version: 1 } })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/skills/${foreign!.id}/stats` })).statusCode).toBe(404);
    await app.close();
  });
});
