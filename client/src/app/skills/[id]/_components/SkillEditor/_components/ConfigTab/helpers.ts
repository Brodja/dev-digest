import type { Skill } from "@devdigest/shared";
import type { SkillInput } from "@/lib/hooks/skills";
import type { SkillFormValues } from "@/components/SkillForm";

/** The form starts from the saved skill. */
export function formValues(skill: Skill): SkillFormValues {
  return {
    name: skill.name,
    description: skill.description,
    type: skill.type,
    body: skill.body,
    enabled: skill.enabled,
  };
}

/**
 * Only the fields that changed — PUT is partial, and an unchanged body must not
 * look like an edit (it would add a version). Description is compared trimmed
 * (the server trims it). `enabled` is not part of the form: its switch saves at
 * once, like the card's, so a stale form can never switch it back.
 */
export function changedFields(skill: Skill, v: SkillFormValues): Partial<SkillInput> {
  const patch: Partial<SkillInput> = {};
  if (v.name !== skill.name) patch.name = v.name;
  if (v.description.trim() !== skill.description) patch.description = v.description.trim();
  if (v.type !== skill.type) patch.type = v.type;
  if (v.body !== skill.body) patch.body = v.body;
  return patch;
}
