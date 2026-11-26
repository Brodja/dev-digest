/* SkillTypeBadge — the coloured type pill of a skill (rubric / convention /
   security / custom). Shared by /skills, the agent Skills tab and the run trace.
   The type is an identifier, shown as-is (like a model id). */
import React from "react";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPE_COLORS } from "./constants";
import { s } from "./styles";

export function SkillTypeBadge({ type }: { type: SkillType }) {
  const c = SKILL_TYPE_COLORS[type] ?? SKILL_TYPE_COLORS.custom;
  return <span style={s.pill(c.color, c.bg)}>{type}</span>;
}
