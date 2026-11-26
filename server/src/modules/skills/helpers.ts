import type { Skill, SkillDetail, SkillStats, SkillVersion } from '@devdigest/shared';
import type { SkillRow, SkillVersionRow } from '../../db/rows.js';
import { ConflictError } from '../../platform/errors.js';
import { isTrustedSkillSource } from '../../platform/skill-trust.js';

/** DB row → API DTO (snake_case). `trusted` is derived from the source. */
export function toSkillDto(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    source: row.source,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    trusted: isTrustedSkillSource(row.source),
  };
}

export function toSkillDetailDto(
  row: SkillRow,
  usedBy: { id: string; name: string }[],
): SkillDetail {
  return { ...toSkillDto(row), used_by: usedBy };
}

export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}

/** What the stats DTO is built from (the repository's usage rows, structurally). */
export interface SkillUsageInput {
  agentId: string;
  agentName: string;
  agentEnabled: boolean;
  linkEnabled: boolean;
  position: number;
}

/**
 * Usage stats. `in_prompt` is the review run's rule (link on AND skill on); the
 * agent's own switch is reported apart, as it decides whether the agent runs at all.
 */
export function toSkillStatsDto(
  skill: Pick<SkillRow, 'id' | 'version' | 'enabled'>,
  versionCount: number,
  usage: SkillUsageInput[],
): SkillStats {
  const agents = usage.map((u) => ({
    agent_id: u.agentId,
    agent_name: u.agentName,
    agent_enabled: u.agentEnabled,
    link_enabled: u.linkEnabled,
    position: u.position,
    in_prompt: u.linkEnabled && skill.enabled,
  }));
  return {
    skill_id: skill.id,
    version: skill.version,
    version_count: versionCount,
    used_by_count: agents.length,
    in_prompt_count: agents.filter((a) => a.in_prompt).length,
    agents,
  };
}

/** 409 for a name the workspace already has. */
export function skillNameTakenError(name: string): ConflictError {
  return new ConflictError('skill_name_taken', `A skill named "${name}" already exists`, { name });
}
