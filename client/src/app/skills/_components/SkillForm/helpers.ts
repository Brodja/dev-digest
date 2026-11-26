import type { SkillType } from "@devdigest/shared";
import { SKILL_BODY_MAX, SKILL_DESCRIPTION_MAX, SKILL_NAME_PATTERN } from "../../constants";

export interface SkillFormValues {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
}

export const EMPTY_SKILL: SkillFormValues = {
  name: "",
  description: "",
  type: "custom",
  body: "",
  enabled: true,
};

export type SkillField = "name" | "description" | "body";

/** An i18n key under `skills.editor.errors` + its ICU values. */
export interface SkillIssue {
  key: string;
  values?: Record<string, number>;
  /** "required" issues are shown only after a save attempt. */
  required?: boolean;
}

/** Client-side mirror of the server's Zod rules (modules/skills/routes.ts). */
export function validateSkill(v: SkillFormValues): Partial<Record<SkillField, SkillIssue>> {
  const issues: Partial<Record<SkillField, SkillIssue>> = {};
  if (!v.name) issues.name = { key: "nameRequired", required: true };
  else if (!SKILL_NAME_PATTERN.test(v.name)) issues.name = { key: "nameFormat" };

  const description = v.description.trim();
  if (!description) issues.description = { key: "descriptionRequired", required: true };
  else if (description.length > SKILL_DESCRIPTION_MAX)
    issues.description = { key: "descriptionTooLong", values: { max: SKILL_DESCRIPTION_MAX } };

  if (!v.body.trim()) issues.body = { key: "bodyRequired", required: true };
  else if (v.body.length > SKILL_BODY_MAX) issues.body = { key: "bodyTooLong", values: { max: SKILL_BODY_MAX } };
  return issues;
}

/** Quick estimate for the editor (≈ chars / 4). The run trace counts with the
    server tokenizer, so the two numbers can differ slightly. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
