/** Skill name = kebab-case slug, same rule as SKILL.md (server/specs/002-skills.md). */
export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const SKILL_NAME_HINT =
  'Use a kebab-case slug: a-z, 0-9 and "-", starting with a letter or digit, up to 64 chars';

export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_BODY_MAX = 40_000;

export const INITIAL_SKILL_VERSION = 1;

/** Unique index on skills(workspace_id, name) — see db/schema/skills.ts. */
export const SKILL_NAME_UNIQUE_INDEX = 'skills_workspace_name_uq';
