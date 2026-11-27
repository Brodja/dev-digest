/* SkillCard — one skill in the Skills Lab list (screen_skills.jsx SkillCard):
   an icon tinted by type, the mono name, the global enabled toggle and a delete
   button, a one-line description, the type chip with "<Source> · v<version>",
   and the usage row — "N agents · X% pull freq · Y% accept" (client/specs/004).
   Clicking the card opens the skill's page; the toggle and the delete button don't. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { SkillListItem } from "@devdigest/shared";
import { SKILL_TYPE_COLORS, SkillTypeBadge } from "@/components/SkillTypeBadge";
import { SOURCE_ICONS } from "../../constants";
import { acceptRateColor, formatRate } from "../../helpers";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  deleting,
  onOpen,
  onToggle,
  onDelete,
}: {
  skill: SkillListItem;
  active?: boolean;
  /** The delete request for this skill is in flight. */
  deleting?: boolean;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
  /** Called after the user confirmed the delete. */
  onDelete: () => void;
}) {
  const t = useTranslations("skills");
  const SourceIcon = Icon[SOURCE_ICONS[skill.source]];
  const tint = SKILL_TYPE_COLORS[skill.type] ?? SKILL_TYPE_COLORS.custom;

  const askDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t("card.deleteConfirm", { name: skill.name }))) onDelete();
  };

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
        <button
          type="button"
          aria-label={t("card.delete", { name: skill.name })}
          title={t("card.deleteTitle")}
          disabled={deleting}
          onClick={askDelete}
          style={s.delete(!!deleting)}
        >
          <Icon.Trash size={13} style={deleting ? s.spinning : undefined} />
        </button>
      </div>
      <div style={s.description}>{skill.description}</div>
      <div style={s.metaRow}>
        <SkillTypeBadge type={skill.type} />
        <span style={s.source}>
          <SourceIcon size={11} />
          {t("card.sourceVersion", { source: t(`source.${skill.source}`), version: skill.version })}
        </span>
        {!skill.trusted && (
          <Badge color="var(--warn)" bg="var(--warn-bg)" icon="Shield">
            {t("card.untrusted")}
          </Badge>
        )}
        {!skill.enabled && <span style={s.disabled}>{t("card.disabled")}</span>}
      </div>
      <div style={s.usageRow} data-testid="skill-usage">
        <span className="tnum" style={s.agentsChip} title={t("card.agentsTitle")}>
          {t("card.agents", { count: skill.used_by_count })}
        </span>
        <span className="tnum" title={t("card.pullTitle")}>
          {t("card.pullFreq", { value: formatRate(skill.pull_rate) })}
        </span>
        <span className="tnum" title={t("card.acceptTitle")} style={{ color: acceptRateColor(skill.accept_rate) }}>
          {t("card.acceptRate", { value: formatRate(skill.accept_rate) })}
        </span>
      </div>
    </div>
  );
}
