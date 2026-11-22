/* SeverityFilter — per-severity counter pills that double as a single-select
   filter for FindingsPanel. Click a level to show only it; click the active
   level again to clear. Counts are computed by the caller from findings it
   already has — no request is made here. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITY_LEVELS } from "../../constants";
import { s, type PillState } from "./styles";

export function SeverityFilter({
  counts,
  active,
  onChange,
}: {
  counts: Record<Severity, number>;
  active: Severity | null;
  onChange: (severity: Severity | null) => void;
}) {
  const t = useTranslations("prReview");
  // A level with no findings is hidden — unless it is the active filter, so it
  // can still be clicked off (e.g. Hide low confidence emptied it).
  const levels = SEVERITY_LEVELS.filter((lvl) => counts[lvl] > 0 || lvl === active);
  if (levels.length === 0) return null;

  return (
    <div role="group" aria-label={t("panel.severityFilter")} style={s.group}>
      {levels.map((lvl) => {
        const state: PillState = active === null ? "idle" : active === lvl ? "active" : "dimmed";
        return (
          <button
            key={lvl}
            type="button"
            aria-pressed={active === lvl}
            onClick={() => onChange(active === lvl ? null : lvl)}
            style={s.pill(SEV[lvl].c, state)}
          >
            {t("panel.severityCount", { count: counts[lvl], label: SEV[lvl].label })}
          </button>
        );
      })}
    </div>
  );
}
