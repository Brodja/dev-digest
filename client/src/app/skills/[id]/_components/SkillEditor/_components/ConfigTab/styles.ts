import type { CSSProperties } from "react";

/** Co-located styles for ConfigTab (screen_skills.jsx SkillConfigTab). */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 18 } satisfies CSSProperties,
  h2: { fontSize: 16, fontWeight: 700 } satisfies CSSProperties,
  enabled: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12.5,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" } satisfies CSSProperties,
  failed: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
  snapshot: { marginLeft: "auto", fontSize: 11.5, color: "var(--text-muted)" } satisfies CSSProperties,
  danger: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    paddingTop: 18,
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
  dangerText: { flex: 1 } satisfies CSSProperties,
  dangerTitle: { fontSize: 13, fontWeight: 600, color: "var(--crit)" } satisfies CSSProperties,
  dangerBody: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 } satisfies CSSProperties,
} as const;
