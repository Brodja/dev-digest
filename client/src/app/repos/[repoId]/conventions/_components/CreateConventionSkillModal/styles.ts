import type { CSSProperties } from "react";

export const s = {
  body: { padding: "18px 22px 8px" } satisfies CSSProperties,
  merged: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 13px",
    borderRadius: 8,
    background: "var(--accent-bg)",
    border: "1px solid var(--border)",
    marginBottom: 18,
    fontSize: 12.5,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  mergedIcon: { color: "var(--accent)", flexShrink: 0 } satisfies CSSProperties,
  footer: { display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" } satisfies CSSProperties,
  failed: { fontSize: 12.5, color: "var(--crit)", marginRight: "auto" } satisfies CSSProperties,
} as const;
