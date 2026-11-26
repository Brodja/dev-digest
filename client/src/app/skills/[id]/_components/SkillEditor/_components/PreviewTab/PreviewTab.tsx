/* PreviewTab — the skill rendered as the reviewing agent receives it
   (screen_skills.jsx SkillPreviewTab). The design-system Markdown is safe for
   untrusted text; an untrusted skill also says how it reaches the prompt. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, Icon, Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { promptBlock } from "./helpers";
import { s } from "./styles";

export function PreviewTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("preview.title")}</h2>
      <p style={s.subtitle}>{t("preview.subtitle")}</p>
      {!skill.trusted && (
        <div role="note" style={s.untrusted}>
          <Icon.Shield size={14} style={s.untrustedIcon} />
          <span>{t("preview.untrustedNotice")}</span>
        </div>
      )}
      <Card>
        <div data-testid="skill-preview">
          <Markdown>{promptBlock(skill)}</Markdown>
        </div>
      </Card>
    </div>
  );
}
