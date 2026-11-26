/* SkillsView — the Skills Lab frame (screen_skills.jsx, client/specs/004):
   the skill list on the left, the selected skill on the right. /skills renders
   it with a placeholder; /skills/:id passes the skill editor as children. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState, type Crumb } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { SkillsSidebar } from "../SkillsSidebar";
import { s } from "./styles";

export function SkillsView({
  activeId,
  tab,
  crumb,
  children,
}: {
  activeId?: string;
  /** The skill page's tab, kept when another skill is picked. */
  tab?: string;
  crumb?: Crumb[];
  children?: React.ReactNode;
}) {
  const t = useTranslations("skills");
  return (
    <AppShell crumb={crumb ?? [{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      <div style={s.frame}>
        <SkillsSidebar activeId={activeId} tab={tab} />
        <main style={s.main}>
          {children ?? (
            <div style={s.placeholder}>
              <EmptyState icon="Sparkles" title={t("page.pickTitle")} body={t("page.pickBody")} />
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
