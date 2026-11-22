import type { CSSProperties } from "react";

/** idle = no severity filter; active = the filtered level; dimmed = another level while a filter is on. */
export type PillState = "idle" | "active" | "dimmed";

/** Co-located styles for SeverityFilter. Colors come from SEV tokens (passed in). */
export const s = {
  group: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  pill: (color: string, state: PillState): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    borderRadius: 99,
    border: `1px solid ${color}`,
    background: state === "active" ? color : "transparent",
    color: state === "active" ? "var(--text-primary)" : color,
    opacity: state === "dimmed" ? 0.5 : 1,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "background .12s, color .12s, opacity .12s",
  }),
} as const;
