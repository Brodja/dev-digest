/* Pure formatting for RunCostBadge — the format table lives in
   server/specs/001-run-cost.md ("Format — formatCost"). */

/** Shown for a missing / unknown cost — never "$0.00". */
export const NO_COST = "—";

/** Below this the cost reads "<$0.0001" (toPrecision would turn exponential). */
export const MIN_SHOWN_USD = 0.0001;

/**
 * USD → short label with at least 3 significant digits:
 * null → "—", 0 → "$0", 0.0814 → "$0.0814", 0.014 → "$0.014", 0.5 → "$0.50", 1.234 → "$1.23".
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd < 0) return NO_COST;
  if (usd === 0) return "$0";
  if (usd < MIN_SHOWN_USD) return `<$${MIN_SHOWN_USD}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  // 3 significant digits, trailing zeros trimmed, but never fewer than 2 decimals
  // ("0.500" → "0.5" → "0.50"; "0.0140" → "0.014"; 0.99951 → "1.00").
  const trimmed = usd.toPrecision(3).replace(/0+$/, "");
  const decimals = trimmed.split(".")[1]?.length ?? 0;
  return `$${decimals < 2 ? usd.toFixed(2) : trimmed}`;
}

/** Total tokens of a run (in + out), or null when neither side is known. */
export function totalTokens(
  tokensIn: number | null | undefined,
  tokensOut: number | null | undefined,
): number | null {
  if (tokensIn == null && tokensOut == null) return null;
  return (tokensIn ?? 0) + (tokensOut ?? 0);
}
