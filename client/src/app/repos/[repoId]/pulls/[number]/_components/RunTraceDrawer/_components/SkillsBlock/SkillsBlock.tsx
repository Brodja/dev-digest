/* SkillsBlock — the skills segment of Prompt assembly (server/specs/002-skills.md):
   the rendered block (copy / fullscreen via PromptBlock) plus how many tokens it
   added and one chip per skill sent, in prompt order, with untrusted ones marked.
   Traces stored before skills lack the counts and show the block without them. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import type { TraceSkill } from "@devdigest/shared";
import { PROMPT_COLORS } from "../../constants";
import { s } from "../../styles";
import { PromptBlock } from "../PromptBlock";

export function SkillsBlock({
  text,
  tokens,
  skills,
  calls,
}: {
  /** prompt_assembly.skills — the block as sent. */
  text: string;
  /** prompt_assembly.skills_tokens. */
  tokens?: number | null;
  /** config.skills, in prompt order. */
  skills?: TraceSkill[] | null;
  /** Number of LLM calls (tool_calls); > 1 = map-reduce, the block went with each. */
  calls: number;
}) {
  const t = useTranslations("runs");
  const hasMeta = tokens != null || (skills?.length ?? 0) > 0;
  const meta = hasMeta ? (
    <>
      {tokens != null && (
        <Badge color="var(--accent)" bg="var(--accent-bg)" mono>
          {t("trace.prompt.skillsTokens", { count: tokens })}
        </Badge>
      )}
      {skills?.map((sk) => (
        <span
          key={sk.id}
          className="mono"
          style={s.skillChip(sk.trusted)}
          title={sk.trusted ? undefined : t("trace.prompt.untrustedSkill")}
          data-testid="trace-skill"
        >
          {!sk.trusted && <Icon.Shield size={11} aria-label={t("trace.prompt.untrusted")} />}
          {sk.name}
          <span style={s.skillChipTokens}>· {t("trace.prompt.skillTokens", { count: sk.tokens })}</span>
        </span>
      ))}
      {calls > 1 && tokens != null && (
        <span style={s.skillPerCall}>{t("trace.prompt.skillsPerCall", { count: calls })}</span>
      )}
    </>
  ) : undefined;

  return <PromptBlock label={t("trace.prompt.skills")} text={text} color={PROMPT_COLORS.skills} meta={meta} />;
}
