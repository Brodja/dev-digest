/* SkillCard — one skill in the Skills Lab list (screen_skills.jsx): an icon
   tinted by type, the mono name, the global enabled toggle, a one-line
   description, the type chip and the source; untrusted / disabled marks.
   Clicking the card opens the skill's page; the toggle saves at once. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SKILL_TYPE_COLORS, SkillTypeBadge } from "@/components/SkillTypeBadge";
import { SOURCE_ICONS } from "../../constants";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onOpen,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const SourceIcon = Icon[SOURCE_ICONS[skill.source]];
  const tint = SKILL_TYPE_COLORS[skill.type] ?? SKILL_TYPE_COLORS.custom;
  return (
    // Mouse: the whole card opens the skill. Keyboard: the name is the button
    // (a role="button" card would nest the toggle's <button> inside it).
    <div onClick={onOpen} style={s.card(!!active, skill.enabled)} data-active={active ? "true" : undefined}>
      <div style={s.headerRow}>
        <div style={s.iconBox(tint.color, tint.bg)}>
          <Icon.Sparkles size={14} />
        </div>
        <button
          type="button"
          className="mono"
          aria-current={active ? "page" : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          style={s.name}
        >
          {skill.name}
        </button>
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle on={skill.enabled} onChange={onToggle} size={14} label={t("card.toggle", { name: skill.name })} />
        </div>
      </div>
      <div style={s.description}>{skill.description}</div>
      <div style={s.metaRow}>
        <SkillTypeBadge type={skill.type} />
        <span style={s.source}>
          <SourceIcon size={11} />
          {t(`source.${skill.source}`)}
        </span>
        {!skill.trusted && (
          <Badge color="var(--warn)" bg="var(--warn-bg)" icon="Shield">
            {t("card.untrusted")}
          </Badge>
        )}
        {!skill.enabled && <span style={s.disabled}>{t("card.disabled")}</span>}
      </div>
    </div>
  );
}
