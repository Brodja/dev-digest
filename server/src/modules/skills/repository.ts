import { and, asc, eq, ne } from 'drizzle-orm';
import type { SkillSource, SkillType } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SkillRow } from '../../db/rows.js';
import { INITIAL_SKILL_VERSION, SKILL_NAME_UNIQUE_INDEX } from './constants.js';
import { skillNameTakenError } from './helpers.js';

/**
 * Skills data-access. Owns `skills` + `skill_versions`; workspace-scoped
 * throughout. The agent side of `agent_skills` (link / order / enable) lives in
 * the agents repository; here it is only read for `usedBy`.
 */

export type { SkillRow };

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source: SkillSource;
  enabled?: boolean;
}

export interface UpdateSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/** True when `err` (or its cause chain — drizzle wraps postgres errors) is a
 *  unique violation of the per-workspace skill name index. */
function isNameConflict(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; e && depth < 5; depth++) {
    const pg = e as { code?: string; constraint_name?: string; cause?: unknown };
    if (pg.code === '23505' && pg.constraint_name === SKILL_NAME_UNIQUE_INDEX) return true;
    e = pg.cause;
  }
  return false;
}

export class SkillsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** Is `name` used by another skill of the workspace (optionally ignoring one id)? */
  async nameTaken(workspaceId: string, name: string, exceptId?: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(
        and(
          eq(t.skills.workspaceId, workspaceId),
          eq(t.skills.name, name),
          ...(exceptId ? [ne(t.skills.id, exceptId)] : []),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /** Insert a skill at v1 AND its first body snapshot, in one transaction. */
  async insert(values: InsertSkill): Promise<SkillRow> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(t.skills)
          .values({
            workspaceId: values.workspaceId,
            name: values.name,
            description: values.description,
            type: values.type,
            source: values.source,
            body: values.body,
            enabled: values.enabled ?? true,
            version: INITIAL_SKILL_VERSION,
          })
          .returning();
        await tx
          .insert(t.skillVersions)
          .values({ skillId: row!.id, version: INITIAL_SKILL_VERSION, body: values.body });
        return row!;
      });
    } catch (err) {
      if (isNameConflict(err)) throw skillNameTakenError(values.name);
      throw err;
    }
  }

  /**
   * Update a skill. A changed body bumps `version` and snapshots the new body
   * into skill_versions (same transaction); metadata / enabled changes don't.
   */
  async update(workspaceId: string, id: string, patch: UpdateSkill): Promise<SkillRow | undefined> {
    try {
      return await this.db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(t.skills)
          .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
          .for('update');
        if (!existing) return undefined;

        const bodyChanged = patch.body !== undefined && patch.body !== existing.body;
        const nextVersion = bodyChanged ? existing.version + 1 : existing.version;

        const changes = {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(bodyChanged ? { body: patch.body, version: nextVersion } : {}),
        };
        // Nothing to write (empty patch, or the same body resent): drizzle
        // rejects an empty SET, and there is no new version to record.
        if (Object.keys(changes).length === 0) return existing;

        const [row] = await tx
          .update(t.skills)
          .set(changes)
          .where(eq(t.skills.id, id))
          .returning();

        if (bodyChanged) {
          await tx
            .insert(t.skillVersions)
            .values({ skillId: id, version: nextVersion, body: patch.body! });
        }
        return row;
      });
    } catch (err) {
      if (isNameConflict(err) && patch.name !== undefined) throw skillNameTakenError(patch.name);
      throw err;
    }
  }

  /** Delete (scoped to workspace). Links + versions go by cascade. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  /** Agents that link this skill (any link state), by agent name. */
  async usedBy(skillId: string): Promise<{ id: string; name: string }[]> {
    return this.db
      .select({ id: t.agents.id, name: t.agents.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(eq(t.agentSkills.skillId, skillId))
      .orderBy(asc(t.agents.name));
  }
}
