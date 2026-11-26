import type { ConventionCandidate, ConventionStatus } from "@devdigest/shared";

/** Candidates by status, keeping the server's order (confidence desc) inside each. */
export function groupByStatus(
  candidates: readonly ConventionCandidate[],
): Record<ConventionStatus, ConventionCandidate[]> {
  const groups: Record<ConventionStatus, ConventionCandidate[]> = { pending: [], accepted: [], rejected: [] };
  for (const c of candidates) groups[c.status].push(c);
  return groups;
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
