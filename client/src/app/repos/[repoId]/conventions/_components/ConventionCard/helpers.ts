import type { ConventionCandidate } from "@devdigest/shared";

/** "L12" or "L12-L14" — the same anchor GitHub uses. */
export function lineRef(c: Pick<ConventionCandidate, "evidence_start_line" | "evidence_end_line">): string {
  return c.evidence_start_line === c.evidence_end_line
    ? `L${c.evidence_start_line}`
    : `L${c.evidence_start_line}-L${c.evidence_end_line}`;
}
