import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

/**
 * Skills CRUD (server/specs/002-skills.md): create / list / get / update /
 * delete, body versioning, unique names, validation, workspace isolation and
 * the cascade to agent links.
 */
d('skills CRUD (Testcontainers pg)', () => {
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

  const skillBody = (over: Record<string, unknown> = {}) => ({
    name: `skill-${seq++}`,
    description: 'Flag any hard-coded secret added in the diff.',
    type: 'security',
    body: '- sk_live_ keys are CRITICAL',
    ...over,
  });

  async function versionsOf(skillId: string) {
    return pg.handle.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(asc(t.skillVersions.version));
  }

  it('creates a manual, trusted, enabled v1 skill with its first body snapshot', async () => {
    const app = await makeApp();
    // A `source` in the body is not accepted: the route decides it.
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: skillBody({ source: 'imported_file' }),
    });
    expect(res.statusCode).toBe(201);
    const skill = res.json();
    expect(skill).toMatchObject({ source: 'manual', trusted: true, enabled: true, version: 1, type: 'security' });

    const versions = await versionsOf(skill.id);
    expect(versions.map((v) => [v.version, v.body])).toEqual([[1, '- sk_live_ keys are CRITICAL']]);
    await app.close();
  });

  it('lists the workspace skills sorted by name and gets one with used_by', async () => {
    const app = await makeApp();
    const b = (await app.inject({ method: 'POST', url: '/skills', payload: skillBody({ name: 'zz-last' }) })).json();
    const a = (await app.inject({ method: 'POST', url: '/skills', payload: skillBody({ name: 'aa-first' }) })).json();

    const list = (await app.inject({ method: 'GET', url: '/skills' })).json() as { name: string }[];
    const names = list.map((s) => s.name);
    expect(names).toEqual([...names].sort());
    expect(names.indexOf('aa-first')).toBeLessThan(names.indexOf('zz-last'));

    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Skill User', provider: 'openai', model: 'gpt-4.1', system_prompt: 'review' },
      })
    ).json();
    await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: { links: [{ skill_id: a.id, enabled: false }] },
    });

    const detail = (await app.inject({ method: 'GET', url: `/skills/${a.id}` })).json();
    expect(detail.used_by).toEqual([{ id: agent.id, name: 'Skill User' }]);
    const unused = (await app.inject({ method: 'GET', url: `/skills/${b.id}` })).json();
    expect(unused.used_by).toEqual([]);
    await app.close();
  });

  it('bumps the version and snapshots only when the body changes', async () => {
    const app = await makeApp();
    const skill = (await app.inject({ method: 'POST', url: '/skills', payload: skillBody() })).json();

    const meta = (
      await app.inject({
        method: 'PUT',
        url: `/skills/${skill.id}`,
        payload: { description: 'Flag committed secrets.', type: 'rubric', enabled: false },
      })
    ).json();
    expect(meta).toMatchObject({ version: 1, description: 'Flag committed secrets.', type: 'rubric', enabled: false });

    const same = (
      await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { body: skill.body } })
    ).json();
    expect(same.version).toBe(1);

    const changed = (
      await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { body: '- new rule' } })
    ).json();
    expect(changed).toMatchObject({ version: 2, body: '- new rule' });

    const versions = await versionsOf(skill.id);
    expect(versions.map((v) => [v.version, v.body])).toEqual([
      [1, '- sk_live_ keys are CRITICAL'],
      [2, '- new rule'],
    ]);
    await app.close();
  });

  it('rejects a duplicate name with 409 skill_name_taken (create and rename)', async () => {
    const app = await makeApp();
    await app.inject({ method: 'POST', url: '/skills', payload: skillBody({ name: 'taken-name' }) });

    const dup = await app.inject({ method: 'POST', url: '/skills', payload: skillBody({ name: 'taken-name' }) });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('skill_name_taken');

    const other = (await app.inject({ method: 'POST', url: '/skills', payload: skillBody() })).json();
    const rename = await app.inject({
      method: 'PUT',
      url: `/skills/${other.id}`,
      payload: { name: 'taken-name' },
    });
    expect(rename.statusCode).toBe(409);
    expect(rename.json().error.code).toBe('skill_name_taken');

    // Renaming a skill to its own name is not a conflict.
    const self = await app.inject({ method: 'PUT', url: `/skills/${other.id}`, payload: { name: other.name } });
    expect(self.statusCode).toBe(200);
    await app.close();
  });

  it('validates name, description, body and type (422)', async () => {
    const app = await makeApp();
    const bad = [
      skillBody({ name: 'Has Spaces' }),
      skillBody({ name: '-leading' }),
      skillBody({ description: '   ' }),
      skillBody({ description: 'x'.repeat(1025) }),
      skillBody({ body: '  \n ' }),
      skillBody({ body: 'x'.repeat(40_001) }),
      skillBody({ type: 'unknown' }),
    ];
    for (const payload of bad) {
      const res = await app.inject({ method: 'POST', url: '/skills', payload });
      expect(res.statusCode, JSON.stringify(payload).slice(0, 80)).toBe(422);
      expect(res.json().error.code).toBe('validation_error');
    }
    await app.close();
  });

  it("does not expose another workspace's skill (404 on get / update / delete)", async () => {
    const app = await makeApp();
    const db = pg.handle.db;
    const [otherWs] = await db.insert(t.workspaces).values({ name: 'other-skills-ws' }).returning();
    const [foreign] = await db
      .insert(t.skills)
      .values({
        workspaceId: otherWs!.id,
        name: 'foreign-skill',
        description: 'd',
        type: 'custom',
        source: 'manual',
        body: 'b',
      })
      .returning();

    expect((await app.inject({ method: 'GET', url: `/skills/${foreign!.id}` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'PUT', url: `/skills/${foreign!.id}`, payload: { enabled: false } })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/skills/${foreign!.id}` })).statusCode).toBe(404);
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json() as { id: string }[];
    expect(list.some((s) => s.id === foreign!.id)).toBe(false);
    await app.close();
  });

  it('deletes a skill; its agent links and versions go by cascade', async () => {
    const app = await makeApp();
    const skill = (await app.inject({ method: 'POST', url: '/skills', payload: skillBody() })).json();
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Cascade Agent', provider: 'openai', model: 'gpt-4.1', system_prompt: 'review' },
      })
    ).json();
    await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: { links: [{ skill_id: skill.id, enabled: true }] },
    });

    const del = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ ok: true });

    expect((await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })).json()).toEqual([]);
    expect(await versionsOf(skill.id)).toEqual([]);
    await app.close();
  });
});
