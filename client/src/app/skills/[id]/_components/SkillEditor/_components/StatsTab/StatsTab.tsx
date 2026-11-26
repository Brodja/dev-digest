/* StatsTab — who uses the skill (screen_skills.jsx SkillStatsTab, trimmed to
   honest data, client/specs/004): Used by, In prompt, Versions, and the agents
   with the skill's place in their order and why it is (not) in their prompt. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, EmptyState, ErrorState, Icon, SectionLabel, Skeleton } from "@devdigest/ui";
import type { SkillUsage } from "@devdigest/shared";
import { useSkillStats } from "@/lib/hooks/skills";
import { s } from "./styles";

export function StatsTab({ skillId }: { skillId: string }) {
  const t = useTranslations("skills");
  const { data: stats, isLoading, isError, refetch } = useSkillStats(skillId);

  if (isLoading) return <Skeleton height={180} />;
  if (isError || !stats) return <ErrorState body={t("stats.loadError")} onRetry={() => refetch()} />;

  return (
    <div style={s.wrap}>
      <div style={s.cards}>
        <Stat label={t("stats.usedBy")} value={stats.used_by_count} suffix={t("stats.agentsUnit", { count: stats.used_by_count })} />
        <Stat label={t("stats.inPrompt")} value={stats.in_prompt_count} suffix={t("stats.agentsUnit", { count: stats.in_prompt_count })} />
        <Stat label={t("stats.versions")} value={stats.version_count} />
      </div>

      {stats.agents.length === 0 ? (
        <EmptyState icon="BarChart" title={t("stats.emptyTitle")} body={t("stats.emptyBody")} />
      ) : (
        <div style={s.panel}>
          <SectionLabel icon="Cpu">{t("stats.agentsTitle")}</SectionLabel>
          <ul style={s.list} aria-label={t("stats.agentsTitle")}>
            {stats.agents.map((a) => (
              <AgentRow key={a.agent_id} usage={a} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div className="tnum" style={s.statValue}>
        {value}
        {suffix && <span style={s.statSuffix}> {suffix}</span>}
      </div>
    </div>
  );
}

function AgentRow({ usage: a }: { usage: SkillUsage }) {
  const t = useTranslations("skills");
  return (
    <li style={s.row(a.in_prompt)} data-testid={`usage-${a.agent_id}`}>
      <span style={s.agentIcon}>
        <Icon.Cpu size={12} />
      </span>
      <span style={s.agentName}>{a.agent_name}</span>
      <span className="mono" style={s.position} title={t("stats.positionTitle", { position: a.position })}>
        {t("stats.position", { position: a.position })}
      </span>
      {a.in_prompt ? (
        <Badge color="var(--ok)" bg="var(--ok-bg)" dot>
          {t("stats.inPromptBadge")}
        </Badge>
      ) : a.link_enabled ? (
        <Badge color="var(--text-muted)">{t("stats.skillDisabled")}</Badge>
      ) : (
        <Badge color="var(--text-muted)">{t("stats.linkOff")}</Badge>
      )}
      {!a.agent_enabled && <Badge color="var(--text-muted)">{t("stats.agentDisabled")}</Badge>}
      <Link
        href={`/agents/${a.agent_id}?tab=skills`}
        style={s.open}
        aria-label={t("stats.openLabel", { name: a.agent_name })}
      >
        {t("stats.open")}
      </Link>
    </li>
  );
}
