import type { IconName } from "@devdigest/ui";

/** Skill page tab. `labelKey` resolves under the `skills` namespace. */
export interface SkillTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

/** The tabs of the skill page (client/specs/004). Context / Evals belong to later lessons. */
export const TABS: readonly SkillTab[] = [
  { key: "config", labelKey: "skill.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "skill.tabs.preview", icon: "Eye" },
  { key: "versions", labelKey: "skill.tabs.versions", icon: "History" },
  { key: "stats", labelKey: "skill.tabs.stats", icon: "BarChart" },
];

/** Valid `?tab=` values (the page falls back to config). */
export const TAB_KEYS: readonly string[] = TABS.map((tb) => tb.key);
