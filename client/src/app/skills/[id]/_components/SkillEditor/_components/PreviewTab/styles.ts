import type { CSSProperties } from "react";

/** Co-located styles for PreviewTab (screen_skills.jsx SkillPreviewTab). */
export const s = {
  wrap: { maxWidth: 720 } satisfies CSSProperties,
  h2: { fontSize: 16, fontWeight: 700, marginBottom: 4 } satisfies CSSProperties,
  subtitle: { fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 } satisfies CSSProperties,
  untrusted: {
    display: "flex",
    gap: 10,
    padding: "10px 12px",
    marginBottom: 14,
    borderRadius: 7,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    fontSize: 13,
    lineHeight: 1.45,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  untrustedIcon: { color: "var(--warn)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  /** Long code lines scroll inside the preview, not the whole pane. */
  body: { overflowX: "auto", minWidth: 0 } satisfies CSSProperties,
} as const;
