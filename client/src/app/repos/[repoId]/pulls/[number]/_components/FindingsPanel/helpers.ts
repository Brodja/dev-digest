import type { FindingRecord, Severity } from "@devdigest/shared";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

/** Optionally drop low-confidence findings and sort by severity. */
export function visibleFindings(findings: FindingRecord[], hideLow: boolean): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

/** Number of findings per severity level (every level present, zeros included). */
export function severityCounts(findings: FindingRecord[]): Record<Severity, number> {
  // Typed literal, not built from SEVERITY_LEVELS: a new contract level fails typecheck here.
  const counts: Record<Severity, number> = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) {
    if (f.severity in counts) counts[f.severity] += 1;
  }
  return counts;
}

/** Keep only findings of one severity; `null` means no severity filter. */
export function filterBySeverity(
  findings: FindingRecord[],
  severity: Severity | null,
): FindingRecord[] {
  return severity ? findings.filter((f) => f.severity === severity) : findings;
}
