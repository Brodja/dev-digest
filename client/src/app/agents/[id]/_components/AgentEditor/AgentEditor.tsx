/* AgentEditor — the agent editor shell: Config (model + system prompt) and
   Skills (linked skills, server/specs/002-skills.md). Later milestones add
   Evals/Stats/CI tabs. Tab state lives in ?tab=. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { SkillsTab } from "./_components/SkillsTab";
import { TABS } from "./constants";
import { s } from "./styles";

export function AgentEditor({ agent, tab, onTab }: { agent: Agent; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("agents");
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));
  return (
    <div style={s.wrap}>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {/* ConfigTab keeps its unsaved local form state in component state, so it
            stays mounted (hidden) while another tab is open. */}
        <div style={tab === "config" ? undefined : s.hidden} aria-hidden={tab !== "config"}>
          <ConfigTab agent={agent} />
        </div>
        {tab === "skills" && <SkillsTab agentId={agent.id} />}
      </div>
    </div>
  );
}
