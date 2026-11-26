import type { Skill, SkillDetail } from '@devdigest/shared';
import type { SkillRow } from '../../db/rows.js';
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

/** 409 for a name the workspace already has. */
export function skillNameTakenError(name: string): ConflictError {
  return new ConflictError('skill_name_taken', `A skill named "${name}" already exists`, { name });
}
