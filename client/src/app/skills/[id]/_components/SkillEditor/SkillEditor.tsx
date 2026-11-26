/* SkillEditor — the skill page body (screen_skills.jsx): a header (type icon,
   mono name, type chip, version, source / untrusted / disabled) and the tabs
   Config, Preview, Versions, Stats. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SKILL_TYPE_COLORS, SkillTypeBadge } from "@/components/SkillTypeBadge";
import { SOURCE_ICONS } from "@/app/skills/constants";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { VersionsTab } from "./_components/VersionsTab";
import { StatsTab } from "./_components/StatsTab";
import { TABS } from "./constants";
import { s } from "./styles";

export function SkillEditor({ skill, tab, onTab }: { skill: Skill; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("skills");
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));
  const tint = SKILL_TYPE_COLORS[skill.type] ?? SKILL_TYPE_COLORS.custom;
  const SourceIcon = Icon[SOURCE_ICONS[skill.source]];

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.iconBox(tint.color, tint.bg)}>
          <Icon.Sparkles size={15} />
        </div>
        <h1 className="mono" style={s.h1}>
          {skill.name}
        </h1>
        <SkillTypeBadge type={skill.type} />
        <Badge color="var(--text-secondary)" icon="GitCommit" mono>
          {t("skill.version", { version: skill.version })}
        </Badge>
        <span style={s.source}>
          <SourceIcon size={12} />
          {t(`source.${skill.source}`)}
        </span>
        {!skill.trusted && (
          <Badge color="var(--warn)" bg="var(--warn-bg)" icon="Shield">
            {t("card.untrusted")}
          </Badge>
        )}
        {!skill.enabled && <Badge color="var(--text-muted)">{t("skill.disabled")}</Badge>}
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {/* ConfigTab keeps unsaved edits in local state, so it stays mounted
            (hidden) under the other tabs. Keyed by version: a new body (saved
            here or restored in Versions) starts the form from the saved skill. */}
        <div style={tab === "config" ? undefined : s.hidden} aria-hidden={tab !== "config"}>
          <ConfigTab key={skill.version} skill={skill} />
        </div>
        {tab === "preview" && <PreviewTab skill={skill} />}
        {tab === "versions" && <VersionsTab skill={skill} />}
        {tab === "stats" && <StatsTab skillId={skill.id} />}
      </div>
    </div>
  );
}
