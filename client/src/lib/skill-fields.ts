/* skill-fields.ts — skill field rules shared by every skill form: /skills (create,
   edit, import) and the Conventions page's "Accept as Skill" modal. Same rules as
   the server (server/src/modules/_shared/skill-fields.ts). */
import type { SkillType } from "@devdigest/shared";

/** Copied from the SkillType enum: the client imports shared contracts as types only. */
export const SKILL_TYPES = ["rubric", "convention", "security", "custom"] as const satisfies readonly SkillType[];

export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_BODY_MAX = 40_000;
