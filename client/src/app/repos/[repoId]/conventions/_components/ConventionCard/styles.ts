import type { CSSProperties } from "react";
import type { ConventionStatus } from "@devdigest/shared";

const BORDER: Record<ConventionStatus, string> = {
  pending: "var(--border)",
  accepted: "var(--ok)",
  rejected: "var(--border)",
};

/** Co-located styles for ConventionCard. Longhand borders only (no border + borderLeft mix). */
export const s = {
  card: (status: ConventionStatus): CSSProperties => ({
    display: "flex",
    gap: 14,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    borderStyle: "solid",
    borderTopColor: "var(--border)",
    borderRightColor: "var(--border)",
    borderBottomColor: "var(--border)",
    borderLeftColor: BORDER[status],
    borderRadius: 9,
    background: "var(--bg-elevated)",
    padding: 16,
    marginBottom: 12,
    opacity: status === "rejected" ? 0.6 : 1,
  }),
  main: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  ruleRow: { display: "flex", alignItems: "flex-start", gap: 8 } satisfies CSSProperties,
  rule: { flex: 1, fontSize: 14, fontWeight: 600, fontStyle: "italic", lineHeight: 1.4 } satisfies CSSProperties,
  editActions: { display: "flex", gap: 8, marginTop: 8 } satisfies CSSProperties,
  evidence: {
    marginTop: 10,
    borderRadius: 7,
    border: "1px solid var(--border)",
    overflow: "hidden",
  } satisfies CSSProperties,
  evidenceHead: {
    padding: "5px 10px",
    background: "var(--bg-surface)",
    borderBottom: "1px solid var(--border)",
    fontSize: 12.5,
  } satisfies CSSProperties,
  snippet: {
    margin: 0,
    padding: "10px 12px",
    fontSize: 11.5,
    lineHeight: 1.55,
    color: "var(--text-primary)",
    background: "var(--code-bg)",
    overflow: "auto",
    whiteSpace: "pre",
  } satisfies CSSProperties,
  confRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 } satisfies CSSProperties,
  confLabel: { fontSize: 11, color: "var(--text-muted)" } satisfies CSSProperties,
  confBar: { width: 90 } satisfies CSSProperties,
  confValue: { fontSize: 11, color: "var(--text-secondary)" } satisfies CSSProperties,
  actions: { display: "flex", flexDirection: "column", gap: 7, flexShrink: 0, width: 150 } satisfies CSSProperties,
  include: { marginTop: 4, fontSize: 12 } satisfies CSSProperties,
} as const;
