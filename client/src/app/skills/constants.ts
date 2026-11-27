/** Constants of the Skills Lab pages (server/specs/002-skills.md, client/specs/004). */
import type { IconName } from "@devdigest/ui";
import type { SkillSource } from "@devdigest/shared";

// Skill field rules (types, name pattern, limits) live in @/lib/skill-fields:
// the Conventions page builds skills with the same form.

export const SOURCE_ICONS: Record<SkillSource, IconName> = {
  manual: "Edit",
  extracted: "Wrench",
  community: "Globe",
  imported_url: "Link",
  imported_file: "Upload",
};

/** Import: same upload limit as the server (checked in the browser first). */
export const IMPORT_MAX_FILE_BYTES = 1_048_576;
export const IMPORT_ACCEPT = ".md,.markdown,.zip,.skill";

/** Accept rate shown green from here, amber below (screen_skills.jsx SkillCard). */
export const ACCEPT_RATE_GOOD = 0.6;
