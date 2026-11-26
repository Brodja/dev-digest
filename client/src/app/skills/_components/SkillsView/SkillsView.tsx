/* /skills — the Skills page (server/specs/002-skills.md): a grid of skill cards,
   a side preview on click, and Add → Create (Import arrives with Part 3). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { SkillCard } from "../SkillCard";
import { SkillPreviewDrawer } from "../SkillPreviewDrawer";
import { SkillEditorModal } from "../SkillEditorModal";
import { filterSkills } from "./helpers";
import { s } from "./styles";

/** Which editor is open: a new skill, or an existing one. */
type EditorState = { mode: "create" } | { mode: "edit"; skill: Skill } | null;

export function SkillsView() {
  const t = useTranslations("skills");
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [search, setSearch] = React.useState("");
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [editor, setEditor] = React.useState<EditorState>(null);

  const all = skills ?? [];
  const list = filterSkills(all, search);
  const openCreate = () => setEditor({ mode: "create" });

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>{t("page.heading")}</h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
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
          <Dropdown
            width={220}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[{ label: t("page.createSkill"), icon: "Edit", onClick: openCreate }]}
          />
        </div>

        {isLoading && (
          <div style={s.grid}>
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={110} />
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && all.length === 0 && (
          <EmptyState
            icon="Sparkles"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={openCreate}
          />
        )}
        {all.length > 0 && list.length === 0 && <p style={s.noMatch}>{t("page.noMatch", { q: search })}</p>}
        {list.length > 0 && (
          <div style={s.grid}>
            {list.map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                active={sk.id === previewId}
                onOpen={() => setPreviewId(sk.id)}
                onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              />
            ))}
          </div>
        )}
      </div>

      {previewId && (
        <SkillPreviewDrawer
          skillId={previewId}
          onClose={() => setPreviewId(null)}
          onEdit={(skill) => setEditor({ mode: "edit", skill })}
        />
      )}
      {/* Rendered after the drawer so the modal stacks on top of it. */}
      {editor && (
        <SkillEditorModal skill={editor.mode === "edit" ? editor.skill : undefined} onClose={() => setEditor(null)} />
      )}
    </AppShell>
  );
}
