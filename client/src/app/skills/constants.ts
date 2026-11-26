/** Constants of the /skills page (server/specs/002-skills.md). */
import type { IconName } from "@devdigest/ui";
import type { SkillSource, SkillType } from "@devdigest/shared";

/** Copied from the SkillType enum: the client imports shared contracts as types only. */
export const SKILL_TYPES = ["rubric", "convention", "security", "custom"] as const satisfies readonly SkillType[];

/** Same rules as the server (modules/skills/constants.ts). */
export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_BODY_MAX = 40_000;

export const SOURCE_ICONS: Record<SkillSource, IconName> = {
  manual: "Edit",
  extracted: "Wrench",
  community: "Globe",
  imported_url: "Link",
  imported_file: "Upload",
};

/** Card grid (responsive auto-fill), same as the agents list. */
export const CARD_GRID_COLS = "repeat(auto-fill, minmax(280px, 1fr))";
