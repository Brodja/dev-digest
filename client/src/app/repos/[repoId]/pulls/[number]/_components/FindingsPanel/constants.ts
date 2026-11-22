// Type-only: a value import of the @devdigest/shared barrel breaks the Next
// build (its `./contracts/*.js` specifiers don't resolve under webpack).
import type { FindingActionKind, Severity } from "@devdigest/shared";

/** Severity levels shown as counters/filters, in display order — the shared
 *  Severity contract (CRITICAL | WARNING | SUGGESTION), so no INFO. */
export const SEVERITY_LEVELS = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[];

/** Sort weight per severity (lower = shown first). */
export const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  WARNING: 1,
  SUGGESTION: 2,
  INFO: 3,
};

/** Confidence below this is hidden when "hide low confidence" is on. */
export const LOW_CONFIDENCE_THRESHOLD = 0.65;

/** Keyboard shortcut → finding action. */
export const KEY_TO_ACTION: Record<string, FindingActionKind> = {
  a: "accept",
  d: "dismiss",
};
