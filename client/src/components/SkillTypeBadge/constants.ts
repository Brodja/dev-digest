import type { SkillType } from "@devdigest/shared";

/** Type → colour tokens (same hues as the design: blue / green / red / grey). */
export const SKILL_TYPE_COLORS: Record<SkillType, { color: string; bg: string }> = {
  rubric: { color: "var(--accent)", bg: "var(--accent-bg)" },
  convention: { color: "var(--ok)", bg: "var(--ok-bg)" },
  security: { color: "var(--crit)", bg: "var(--crit-bg)" },
  custom: { color: "var(--info)", bg: "var(--info-bg)" },
};
