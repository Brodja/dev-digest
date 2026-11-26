/* SkillCard — one skill in the /skills grid: name, type, one-line description,
   source, untrusted badge and the global enabled toggle. Clicking the card opens
   the side preview; the toggle saves at once and does not open it. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/SkillTypeBadge";
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
  return (
    // Mouse: the whole card opens the preview. Keyboard: the name is the button
    // (a role="button" card would nest the toggle's <button> inside it).
    <div onClick={onOpen} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Sparkles size={14} />
        </div>
        <button
          type="button"
          className="mono"
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
