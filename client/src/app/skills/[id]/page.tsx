/* /skills/:id — the skill page (client/specs/004-skills-lab-design.md): the
   Skills Lab list on the left, the skill editor with Config / Preview /
   Versions / Stats on the right. Tab state lives in ?tab=. Mirrors /agents/:id. */
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import { ApiError } from "@/lib/api";
import { useSkill } from "@/lib/hooks/skills";
import { SkillsView } from "../_components/SkillsView";
import { SkillEditor, TAB_KEYS } from "./_components/SkillEditor";

export default function SkillPage() {
  const t = useTranslations("skills");
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);

  const requested = search.get("tab") ?? "";
  const tab = TAB_KEYS.includes(requested) ? requested : "config";
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${id}?${sp.toString()}`);
  };

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    { label: skill?.name ?? "…", mono: true },
  ];

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton height={26} width={260} />
        <Skeleton height={36} />
        <Skeleton height={240} />
      </div>
    );
  } else if (error instanceof ApiError && error.status === 404) {
    content = <ErrorState title={t("skill.notFoundTitle")} body={t("skill.notFound")} />;
  } else if (isError || !skill) {
    content = <ErrorState body={t("skill.loadError")} onRetry={() => refetch()} />;
  } else {
    // Keyed by id: another skill starts with fresh tab state.
    content = <SkillEditor key={skill.id} skill={skill} tab={tab} onTab={setTab} />;
  }

  return (
    <SkillsView activeId={id} tab={tab} crumb={crumb}>
      {content}
    </SkillsView>
  );
}
