/* SkillsTab — every workspace skill in one list (screen_agents.jsx SkillsTab,
   client/specs/004): the linked ones first, in prompt order, then the rest. The
   checkbox links / unlinks; linked rows reorder by drag, or by ArrowUp /
   ArrowDown on the focused grip. The order here is the order of the skill
   blocks in the prompt. Every change PUTs the full list. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/SkillTypeBadge";
import { useAgentSkills, useSetAgentSkills } from "@/lib/hooks/agents";
import { useSkills } from "@/lib/hooks/skills";
import { filterSkills } from "@/lib/skill-search";
import { useToast } from "@/lib/toast";
import { moveItem, splitRows, toggleLink, toLinkInputs } from "./helpers";
import { useDragReorder } from "./hooks";
import { s } from "./styles";

export function SkillsTab({ agentId }: { agentId: string }) {
  const t = useTranslations("agents");
  const router = useRouter();
  const toast = useToast();
  const links = useAgentSkills(agentId);
  const skills = useSkills();
  const setLinks = useSetAgentSkills();
  const [filter, setFilter] = React.useState("");

  const all = skills.data ?? [];
  const { linked, rest } = splitRows(links.data ?? [], all);
  const linkedIds = linked.map((sk) => sk.id);
  // The hook already rolled the optimistic change back; say so.
  const commit = (ids: string[]) =>
    setLinks.mutate(
      { agentId, links: toLinkInputs(ids) },
      { onError: (err) => toast.error(t("skills.saveFailed", { message: (err as Error).message })) },
    );
  const move = (from: number, to: number) => commit(moveItem(linkedIds, from, to));
  const { dragIndex, overIndex, rowProps } = useDragReorder(move);

  // Reordering a filtered list would move rows the user cannot see.
  const filtering = filter.trim() !== "";
  const shownLinked = filterSkills(linked, filter);
  const shownRest = filterSkills(rest, filter);
  // What reaches the prompt: linked AND switched on on the Skills page (the run's rule).
  const enabledCount = linked.filter((sk) => sk.enabled).length;

  if (links.isLoading || skills.isLoading) {
    return (
      <div style={s.wrap}>
        <Skeleton height={22} width={200} />
        <Skeleton height={44} style={{ marginTop: 16 }} />
        <Skeleton height={44} style={{ marginTop: 6 }} />
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
  if (all.length === 0) {
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

  const nameAndMarks = (skill: Skill, checked: boolean) => (
    <>
      <Checkbox
        checked={checked}
        onChange={() => commit(toggleLink(linkedIds, skill.id))}
        label={
          <span className="mono" style={s.name}>
            {skill.name}
          </span>
        }
      />
      <span style={s.spacer} />
      <SkillTypeBadge type={skill.type} />
      {!skill.trusted && (
        <Badge color="var(--warn)" bg="var(--warn-bg)" icon="Shield">
          {t("skills.untrusted")}
        </Badge>
      )}
      {!skill.enabled && <span style={s.globalOff}>{t("skills.globallyDisabled")}</span>}
    </>
  );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent-text)" bg="var(--accent-bg)">
          {t("skills.enabledCount", { enabled: enabledCount, total: all.length })}
        </Badge>
        <div style={s.filter}>
          <Icon.Search size={13} style={s.filterIcon} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("skills.filterPlaceholder")}
            aria-label={t("skills.filterPlaceholder")}
            style={s.filterInput}
          />
        </div>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      <ol style={s.list} aria-label={t("skills.title")}>
        {shownLinked.map((skill) => {
          const i = linkedIds.indexOf(skill.id);
          return (
            <li
              key={skill.id}
              data-testid={`skill-row-${skill.name}`}
              {...(filtering ? {} : rowProps(i))}
              style={s.row(true, dragIndex === i, overIndex === i && dragIndex !== i, !filtering)}
            >
              <button
                type="button"
                aria-label={t("skills.reorder", { name: skill.name })}
                title={t("skills.drag")}
                disabled={filtering}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" && i > 0) {
                    e.preventDefault();
                    move(i, i - 1);
                  } else if (e.key === "ArrowDown" && i < linkedIds.length - 1) {
                    e.preventDefault();
                    move(i, i + 1);
                  }
                }}
                style={s.grip(!filtering)}
              >
                <Icon.Menu size={14} />
              </button>
              {nameAndMarks(skill, true)}
            </li>
          );
        })}
        {shownRest.map((skill) => (
          <li key={skill.id} data-testid={`skill-row-${skill.name}`} style={s.row(false, false, false, false)}>
            <span aria-hidden="true" style={s.grip(false)}>
              <Icon.Menu size={14} />
            </span>
            {nameAndMarks(skill, false)}
          </li>
        ))}
      </ol>
      {shownLinked.length + shownRest.length === 0 && <p style={s.none}>{t("skills.noMatch", { q: filter })}</p>}
    </div>
  );
}
