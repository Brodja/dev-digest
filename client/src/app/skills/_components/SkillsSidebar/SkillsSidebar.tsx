/* SkillsSidebar — the left column of the Skills Lab (screen_skills.jsx):
   "Skills", Add Skill ▾ (Create from scratch / Import from file), search and
   the skill cards. A card opens /skills/:id (keeping the current tab); a new or
   imported skill opens its page. Shown on /skills and /skills/:id. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { filterSkills } from "@/lib/skill-search";
import { useToast } from "@/lib/toast";
import { SkillCard } from "../SkillCard";
import { CreateSkillModal } from "../CreateSkillModal";
import { ImportSkillModal } from "../ImportSkillModal";
import { s } from "./styles";

export function SkillsSidebar({ activeId, tab }: { activeId?: string; tab?: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const open = (id: string) => router.push(`/skills/${id}${tab ? `?tab=${tab}` : ""}`);
  const toggle = (skill: Skill, enabled: boolean) =>
    update.mutate(
      { id: skill.id, patch: { enabled } },
      {
        onError: (err) =>
          toast.error(t("card.toggleFailed", { name: skill.name, message: (err as Error).message })),
      },
    );

  const all = skills ?? [];
  const list = filterSkills(all, search);

  return (
    <aside style={s.column} aria-label={t("page.heading")}>
      <div style={s.top}>
        <div style={s.titleRow}>
          <h1 style={s.h1}>{t("page.heading")}</h1>
          <Dropdown
            width={220}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[
              { label: t("page.createSkill"), icon: "Edit", onClick: () => setCreating(true) },
              { label: t("page.importSkill"), icon: "Upload", onClick: () => setImporting(true) },
            ]}
          />
        </div>
        <div style={s.search}>
          <Icon.Search size={13} style={s.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("page.searchPlaceholder")}
            aria-label={t("page.searchPlaceholder")}
            style={s.searchInput}
          />
        </div>
      </div>

      <div style={s.list}>
        {isLoading && (
          <div style={s.loading}>
            <Skeleton height={86} />
            <Skeleton height={86} />
            <Skeleton height={86} />
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && all.length === 0 && (
          <EmptyState
            icon="Sparkles"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={() => setCreating(true)}
          />
        )}
        {all.length > 0 && list.length === 0 && <p style={s.noMatch}>{t("page.noMatch", { q: search })}</p>}
        {list.map((sk) => (
          <SkillCard
            key={sk.id}
            skill={sk}
            active={sk.id === activeId}
            onOpen={() => open(sk.id)}
            onToggle={(enabled) => toggle(sk, enabled)}
          />
        ))}
      </div>

      {creating && <CreateSkillModal onClose={() => setCreating(false)} onCreated={(sk) => open(sk.id)} />}
      {importing && <ImportSkillModal onClose={() => setImporting(false)} onImported={(sk) => open(sk.id)} />}
    </aside>
  );
}
