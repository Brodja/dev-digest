/* SkillsTab — the agent's linked skills (server/specs/002-skills.md): link,
   enable / disable per agent, unlink, reorder by drag or ↑/↓. The order here is
   the order of the skill blocks in the prompt. Every change PUTs the full list. */
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, EmptyState, ErrorState, Icon, IconBtn, SearchableSelect, Skeleton, Toggle } from "@devdigest/ui";
import { SkillTypeBadge } from "@/components/SkillTypeBadge";
import { useAgentSkills, useSetAgentSkills } from "@/lib/hooks/agents";
import { useSkills } from "@/lib/hooks/skills";
import { linkedRows, moveItem, toLinkInputs, type LinkInput } from "./helpers";
import { useDragReorder } from "./hooks";
import { s } from "./styles";

export function SkillsTab({ agentId }: { agentId: string }) {
  const t = useTranslations("agents");
  const router = useRouter();
  const links = useAgentSkills(agentId);
  const skills = useSkills();
  const setLinks = useSetAgentSkills();

  const rows = linkedRows(links.data ?? [], skills.data ?? []);
  const current = toLinkInputs(rows);
  const commit = (next: LinkInput[]) => setLinks.mutate({ agentId, links: next });
  const move = (from: number, to: number) => commit(moveItem(current, from, to));
  const { dragIndex, overIndex, rowProps } = useDragReorder(move);

  const linkedIds = new Set((links.data ?? []).map((l) => l.skill_id));
  const unlinked = (skills.data ?? []).filter((sk) => !linkedIds.has(sk.id));
  // What actually reaches the prompt: link on AND skill on (same rule as the run).
  const enabledCount = rows.filter((r) => r.enabled && r.skill.enabled).length;

  if (links.isLoading || skills.isLoading) {
    return (
      <div style={s.wrap}>
        <Skeleton height={22} width={200} />
        <Skeleton height={48} style={{ marginTop: 16 }} />
        <Skeleton height={48} style={{ marginTop: 8 }} />
      </div>
    );
  }
  if (links.isError || skills.isError) {
    const retry = () => {
      void links.refetch();
      void skills.refetch();
    };
    return <ErrorState body={t("skills.loadError")} onRetry={retry} />;
  }
  if ((skills.data ?? []).length === 0) {
    return (
      <EmptyState
        icon="Sparkles"
        title={t("skills.noSkills.title")}
        body={t("skills.noSkills.body")}
        cta={t("skills.noSkills.cta")}
        onCta={() => router.push("/skills")}
      />
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent)" bg="var(--accent-bg)">
          {t("skills.enabledCount", { enabled: enabledCount, linked: rows.length })}
        </Badge>
        <Link href="/skills" style={s.manage}>
          {t("skills.manage")}
        </Link>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      {rows.length === 0 ? (
        <p style={s.none}>{t("skills.noneLinked")}</p>
      ) : (
        <ol style={s.list} aria-label={t("skills.title")}>
          {rows.map((row, i) => {
            const { skill } = row;
            return (
              <li
                key={skill.id}
                data-testid={`skill-row-${skill.name}`}
                {...rowProps(i)}
                style={s.row(row.enabled && skill.enabled, dragIndex === i, overIndex === i && dragIndex !== i)}
              >
                <span title={t("skills.drag")} style={s.grip}>
                  <Icon.GripVertical size={15} />
                </span>
                <span className="mono" style={s.position}>
                  {i + 1}
                </span>
                <span className="mono" style={s.name}>
                  {skill.name}
                </span>
                <SkillTypeBadge type={skill.type} />
                {!skill.trusted && (
                  <Badge color="var(--warn)" bg="var(--warn-bg)" icon="Shield">
                    {t("skills.untrusted")}
                  </Badge>
                )}
                {!skill.enabled && <span style={s.globalOff}>{t("skills.globallyDisabled")}</span>}
                <span style={s.actions}>
                  {i > 0 ? (
                    <IconBtn icon="ArrowUp" size={26} label={t("skills.moveUp", { name: skill.name })} onClick={() => move(i, i - 1)} />
                  ) : (
                    <span style={s.btnSpacer} />
                  )}
                  {i < rows.length - 1 ? (
                    <IconBtn
                      icon="ArrowDown"
                      size={26}
                      label={t("skills.moveDown", { name: skill.name })}
                      onClick={() => move(i, i + 1)}
                    />
                  ) : (
                    <span style={s.btnSpacer} />
                  )}
                  <Toggle
                    on={row.enabled}
                    size={14}
                    label={t("skills.toggle", { name: skill.name })}
                    onChange={(enabled) => commit(current.map((l, j) => (j === i ? { ...l, enabled } : l)))}
                  />
                  <IconBtn
                    icon="X"
                    size={26}
                    danger
                    label={t("skills.unlink", { name: skill.name })}
                    onClick={() => commit(current.filter((_, j) => j !== i))}
                  />
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div style={s.linkRow}>
        {unlinked.length === 0 ? (
          <span style={s.none}>{t("skills.allLinked")}</span>
        ) : (
          <SearchableSelect
            value=""
            mono
            placeholder={t("skills.linkPlaceholder")}
            options={unlinked.map((sk) => ({ value: sk.id, label: sk.name }))}
            onChange={(id) => id && commit([...current, { skill_id: id, enabled: true }])}
          />
        )}
      </div>
    </div>
  );
}
