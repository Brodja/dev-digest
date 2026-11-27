import type { CSSProperties } from "react";

export const s = {
  row: { display: "flex", gap: 16, alignItems: "flex-start" } satisfies CSSProperties,
  typeCol: { flex: 1 } satisfies CSSProperties,
  lockedType: { display: "flex", alignItems: "center", height: 36 } satisfies CSSProperties,
  enabledCol: { flex: 1 } satisfies CSSProperties,
  error: { fontSize: 12, color: "var(--crit)", marginTop: 6 } satisfies CSSProperties,
} as const;
