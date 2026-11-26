import type { Skill } from "@devdigest/shared";
import type { SkillInput } from "@/lib/hooks/skills";
import { EMPTY_SKILL, type SkillFormValues } from "@/components/SkillForm";

/** Form values for a skill being edited, or the empty form for a new one. */
export function initialValues(skill?: Skill): SkillFormValues {
  if (!skill) return EMPTY_SKILL;
  return {
    name: skill.name,
    description: skill.description,
    type: skill.type,
    body: skill.body,
    enabled: skill.enabled,
  };
}

/** Only the fields that changed — PUT is partial, and an unchanged body must
    not look like an edit. Description is compared trimmed (the server trims it). */
export function changedFields(skill: Skill, v: SkillFormValues): Partial<SkillInput> {
  const patch: Partial<SkillInput> = {};
  if (v.name !== skill.name) patch.name = v.name;
  if (v.description.trim() !== skill.description) patch.description = v.description.trim();
  if (v.type !== skill.type) patch.type = v.type;
  if (v.body !== skill.body) patch.body = v.body;
  if (v.enabled !== skill.enabled) patch.enabled = v.enabled;
  return patch;
}
