/** Pure helpers of the Skills Lab pages (the list card and the Stats tab). */
import { ACCEPT_RATE_GOOD } from "./constants";

/** A 0..1 rate as a whole percent; "—" when there is no data (null). */
export function formatRate(rate: number | null | undefined): string {
  return rate == null ? "—" : `${Math.round(rate * 100)}%`;
}

/** Accept-rate colour as in the design: green from 60%, amber below, muted without data. */
export function acceptRateColor(rate: number | null | undefined): string {
  if (rate == null) return "var(--text-muted)";
  return rate >= ACCEPT_RATE_GOOD ? "var(--ok)" : "var(--warn)";
}
