import type { CSSProperties } from "react";

/* Size and color are inherited from the placement (PR list cell, timeline
   meta column, review header, trace stat tile). */
export const s = {
  badge: { whiteSpace: "nowrap" } satisfies CSSProperties,
} as const;
