import { z } from 'zod';

/**
 * Skill field rules shared by every route that creates or edits a skill: the
 * skills module (POST/PUT /skills, import) and the conventions extractor
 * (POST /repos/:id/conventions/skill). See server/specs/002-skills.md (Data → Rules).
 */

/** Skill name = kebab-case slug, same rule as SKILL.md. */
export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const SKILL_NAME_HINT =
  'Use a kebab-case slug: a-z, 0-9 and "-", starting with a letter or digit, up to 64 chars';

export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_BODY_MAX = 40_000;

export const SkillName = z.string().regex(SKILL_NAME_PATTERN, SKILL_NAME_HINT);
export const SkillDescription = z.string().trim().min(1).max(SKILL_DESCRIPTION_MAX);
export const SkillBody = z
  .string()
  .max(SKILL_BODY_MAX)
  .refine((s) => s.trim().length > 0, 'Body must not be blank');
