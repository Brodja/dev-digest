import type { CSSProperties } from "react";

/** Co-located styles for StatsTab (screen_skills.jsx SkillStatsTab / SkillStat). */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  cards: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" } satisfies CSSProperties,
  stat: {
    flex: "1 1 160px",
    padding: 15,
    borderRadius: 9,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  statValue: { marginTop: 10, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  statSuffix: { fontSize: 15, fontWeight: 500, color: "var(--text-muted)" } satisfies CSSProperties,
  panel: {
    padding: 16,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  row: (inPrompt: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 10px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    opacity: inPrompt ? 1 : 0.75,
    flexWrap: "wrap",
  }),
  agentIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: "var(--accent-bg)",
    color: "var(--accent)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  } satisfies CSSProperties,
  agentName: { fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0 } satisfies CSSProperties,
  position: { fontSize: 11.5, color: "var(--text-muted)" } satisfies CSSProperties,
  open: { fontSize: 12, color: "var(--accent-text)", textDecoration: "none", fontWeight: 600 } satisfies CSSProperties,
} as const;
