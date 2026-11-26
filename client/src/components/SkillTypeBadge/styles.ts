import type { CSSProperties } from "react";

export const s = {
  pill: (color: string, bg: string): CSSProperties => ({
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    padding: "1px 7px",
    borderRadius: 4,
    whiteSpace: "nowrap",
  }),
} as const;
