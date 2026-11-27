import type { ConventionCandidate, ConventionStatus } from "@devdigest/shared";

/**
 * One list whose order never depends on the status (client/specs/004): the
 * server sorts pending → accepted → rejected (made for the old sections), so a
 * click on Accept would make the card jump. Same keys as the server minus the
 * status: confidence desc, then age, rule and id as tie-breakers.
 */
export function stableOrder(candidates: readonly ConventionCandidate[]): ConventionCandidate[] {
  return [...candidates].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      a.created_at.localeCompare(b.created_at) ||
      (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** What the Select all / Deselect all toggle does right now. */
export interface BulkAction {
  kind: "select" | "deselect";
  ids: string[];
  status: ConventionStatus;
}

/**
 * The accepted set is the skill (client/specs/004). While any candidate is still
 * to review, the toggle accepts every one of them (rejected ones stay rejected);
 * once all are decided, it moves the accepted ones back to review. Null when
 * there is nothing to select or deselect (no candidates, or all rejected).
 */
export function bulkAction(candidates: readonly ConventionCandidate[]): BulkAction | null {
  const pending = candidates.filter((c) => c.status === "pending");
  if (pending.length > 0) return { kind: "select", ids: pending.map((c) => c.id), status: "accepted" };
  const accepted = candidates.filter((c) => c.status === "accepted");
  if (accepted.length > 0) return { kind: "deselect", ids: accepted.map((c) => c.id), status: "pending" };
  return null;
}

/** Error codes the page explains in its own words (messages: page.errors.*). */
export const KNOWN_SCAN_ERRORS = [
  "repo_not_indexed",
  "repo_intel_disabled",
  "repo_not_cloned",
  "repo_changed",
  "extraction_running",
  "llm_bad_output",
] as const;
export type KnownScanError = (typeof KNOWN_SCAN_ERRORS)[number];

export function isKnownScanError(code: string | null | undefined): code is KnownScanError {
  return (KNOWN_SCAN_ERRORS as readonly string[]).includes(code ?? "");
}
