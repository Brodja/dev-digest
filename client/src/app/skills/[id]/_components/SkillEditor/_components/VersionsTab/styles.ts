import type { CSSProperties } from "react";

/** Co-located styles for VersionsTab (screen_skills.jsx SkillVersionsTab). */
export const s = {
  wrap: { maxWidth: 720 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 } satisfies CSSProperties,
  h2: { fontSize: 16, fontWeight: 700 } satisfies CSSProperties,
  subtitle: { fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 } satisfies CSSProperties,
  empty: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  row: (current: boolean): CSSProperties => ({
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid " + (current ? "var(--border-strong)" : "var(--border)"),
    background: "var(--bg-elevated)",
  }),
  rowMain: { display: "flex", alignItems: "center", gap: 12 } satisfies CSSProperties,
  pill: (current: boolean): CSSProperties => ({
    fontSize: 12.5,
    fontWeight: 700,
    color: current ? "var(--accent-text)" : "var(--text-secondary)",
    background: current ? "var(--accent-bg)" : "var(--bg-hover)",
    padding: "3px 9px",
    borderRadius: 6,
    flexShrink: 0,
  }),
  meta: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  when: { fontSize: 13, fontWeight: 500, color: "var(--text-primary)" } satisfies CSSProperties,
  tokens: { fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 } satisfies CSSProperties,
  diff: {
    marginTop: 10,
    padding: "8px 0",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--code-bg)",
    fontSize: 11.5,
    lineHeight: 1.6,
    maxHeight: 320,
    overflow: "auto",
  } satisfies CSSProperties,
  line: (kind: "same" | "add" | "del"): CSSProperties => ({
    padding: "0 12px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    background: kind === "add" ? "var(--code-add)" : kind === "del" ? "var(--code-del)" : "transparent",
    color:
      kind === "add" ? "var(--code-add-text)" : kind === "del" ? "var(--code-del-text)" : "var(--text-secondary)",
  }),
  skip: { padding: "0 12px", color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
