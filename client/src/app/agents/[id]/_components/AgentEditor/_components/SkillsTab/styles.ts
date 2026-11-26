import type { CSSProperties } from "react";

/** Co-located styles for the agent's Skills tab. */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  manage: { marginLeft: "auto", fontSize: 13, color: "var(--accent-text)", textDecoration: "none" } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" } satisfies CSSProperties,
  none: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  row: (active: boolean, dragging: boolean, over: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 7,
    border: "1px solid " + (over ? "var(--accent)" : "var(--border)"),
    background: active ? "var(--bg-hover)" : "var(--bg-elevated)",
    opacity: dragging ? 0.4 : active ? 1 : 0.65,
    cursor: "grab",
  }),
  grip: { color: "var(--text-muted)", display: "inline-flex" } satisfies CSSProperties,
  position: { fontSize: 12, color: "var(--text-muted)", width: 16, textAlign: "right" } satisfies CSSProperties,
  name: {
    fontSize: 13,
    fontWeight: 600,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  globalOff: { fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" } satisfies CSSProperties,
  actions: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 } satisfies CSSProperties,
  btnSpacer: { width: 26, height: 26, display: "inline-block" } satisfies CSSProperties,
  linkRow: { marginTop: 14, maxWidth: 360 } satisfies CSSProperties,
} as const;
