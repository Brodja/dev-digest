import type { Skill, SkillDetail, SkillListItem, SkillStats, SkillVersion } from '@devdigest/shared';
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

/** The raw counts the rates come from (the repository's usage totals, structurally). */
export interface UsageCounts {
  usedBy: number;
  runs: number;
  totalRuns: number;
  accepted: number;
  dismissed: number;
}

export interface UsageRates {
  used_by_count: number;
  pull_rate: number | null;
  accept_rate: number | null;
}

/**
 * pull_rate = runs that sent the skill / all traced runs of the workspace;
 * accept_rate = accepted / (accepted + dismissed) findings of those runs.
 * Null when there is nothing to divide by (no runs, no decided findings), so the
 * UI shows "—" rather than a fake 0%.
 */
export function usageRates(c: UsageCounts | undefined): UsageRates {
  if (!c) return { used_by_count: 0, pull_rate: null, accept_rate: null };
  const decided = c.accepted + c.dismissed;
  return {
    used_by_count: c.usedBy,
    pull_rate: c.totalRuns > 0 ? c.runs / c.totalRuns : null,
    accept_rate: decided > 0 ? c.accepted / decided : null,
  };
}

/** GET /skills item: the skill plus its usage rates. */
export function toSkillListItemDto(row: SkillRow, counts: UsageCounts | undefined): SkillListItem {
  return { ...toSkillDto(row), ...usageRates(counts) };
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
  counts?: UsageCounts,
): SkillStats {
  const { pull_rate, accept_rate } = usageRates(counts);
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
    pull_rate,
    accept_rate,
    agents,
  };
}

/** 409 for a name the workspace already has. */
export function skillNameTakenError(name: string): ConflictError {
  return new ConflictError('skill_name_taken', `A skill named "${name}" already exists`, { name });
}
