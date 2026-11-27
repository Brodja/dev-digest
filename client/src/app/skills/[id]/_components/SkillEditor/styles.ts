import type { CSSProperties } from "react";

/** Co-located styles for the skill page body (screen_skills.jsx editor column). */
export const s = {
  wrap: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 24px 0",
    flexWrap: "wrap",
    flexShrink: 0,
  } satisfies CSSProperties,
  iconBox: (color: string, bg: string): CSSProperties => ({
    width: 26,
    height: 26,
    borderRadius: 7,
    background: bg,
    color,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  }),
  h1: { fontSize: 16, fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" } satisfies CSSProperties,
  source: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  tabsBar: { marginTop: 12, flexShrink: 0 } satisfies CSSProperties,
  body: { flex: 1, overflow: "auto", padding: 24 } satisfies CSSProperties,
  hidden: { display: "none" } satisfies CSSProperties,
} as const;
