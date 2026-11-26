import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView (layout follows the design's screen_conv_conf). */
export const s = {
  page: { padding: "20px 28px 40px", maxWidth: 880, margin: "0 auto" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 } satisfies CSSProperties,
  headerText: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  repo: { color: "var(--accent-text)" } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", marginTop: 3 } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } satisfies CSSProperties,
  selected: { fontSize: 12, color: "var(--text-muted)", marginRight: 4 } satisfies CSSProperties,
  banner: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "10px 13px",
    borderRadius: 8,
    border: "1px solid var(--crit)",
    background: "var(--crit-bg)",
    color: "var(--text-primary)",
    fontSize: 13,
    marginBottom: 16,
  } satisfies CSSProperties,
  bannerIcon: { color: "var(--crit)", flexShrink: 0, marginTop: 1 } satisfies CSSProperties,
  bannerTitle: { fontWeight: 600 } satisfies CSSProperties,
  note: { fontSize: 13, color: "var(--text-muted)", margin: "8px 0 16px" } satisfies CSSProperties,
  section: { marginBottom: 22 } satisfies CSSProperties,
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 10,
  } satisfies CSSProperties,
  skeletons: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
