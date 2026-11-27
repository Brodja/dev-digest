import type { CSSProperties } from "react";

/** Co-located styles for SkillsSidebar (screen_skills.jsx left column, 290px). */
export const s = {
  column: {
    width: 290,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
    minHeight: 0,
  } satisfies CSSProperties,
  top: { padding: "14px 14px 10px" } satisfies CSSProperties,
  titleRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 } satisfies CSSProperties,
  h1: { fontSize: 16, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  search: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
  } satisfies CSSProperties,
  searchIcon: { color: "var(--text-muted)", flexShrink: 0 } satisfies CSSProperties,
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  list: { flex: 1, overflow: "auto", padding: "0 10px 10px" } satisfies CSSProperties,
  loading: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  noMatch: { fontSize: 13, color: "var(--text-muted)", padding: "4px 4px" } satisfies CSSProperties,
} as const;
