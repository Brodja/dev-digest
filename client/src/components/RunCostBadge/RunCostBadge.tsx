/* RunCostBadge — what one agent run cost (spec: server/specs/001-run-cost.md).
   compact  → "$0.014"              (PR list, review-run header, trace sidebar)
   detailed → "9,119 tok · $0.0814" (timeline row, under the launch time)
   The tooltip carries the exact, unrounded USD — the same number the run's
   Live log prints as "Cost: $…". Callers render it only for finished runs. */
"use client";

import { useTranslations } from "next-intl";
import { formatCost, totalTokens } from "./helpers";
import { s } from "./styles";

export type RunCostBadgeVariant = "compact" | "detailed";

export interface RunCostBadgeProps {
  /** USD for the whole run; null/undefined = unknown → "—". */
  costUsd: number | null | undefined;
  variant?: RunCostBadgeVariant;
  /** Used by the "detailed" variant only. */
  tokensIn?: number | null;
  tokensOut?: number | null;
}

export function RunCostBadge({ costUsd, variant = "compact", tokensIn, tokensOut }: RunCostBadgeProps) {
  const t = useTranslations("common");
  const cost = formatCost(costUsd);
  const tokens = variant === "detailed" ? totalTokens(tokensIn, tokensOut) : null;
  const title = costUsd != null && Number.isFinite(costUsd) ? `$${costUsd}` : t("runCost.unknown");
  return (
    <span className="mono tnum" style={s.badge} title={title} data-testid="run-cost">
      {tokens != null ? `${t("runCost.tokens", { count: tokens })} · ${cost}` : cost}
    </span>
  );
}

export default RunCostBadge;
