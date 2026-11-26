import type { CSSProperties } from "react";

/** Co-located styles for SkillsView: two panes under the 52px top bar (as /agents/:id). */
export const s = {
  frame: { display: "flex", height: "calc(100vh - 52px)" } satisfies CSSProperties,
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 } satisfies CSSProperties,
  placeholder: { flex: 1, display: "grid", placeItems: "center", padding: 40 } satisfies CSSProperties,
} as const;
