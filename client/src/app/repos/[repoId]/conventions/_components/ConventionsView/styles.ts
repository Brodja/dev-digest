import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView (screen_conv_conf.jsx ScreenConventions). */
export const s = {
  page: { padding: "20px 28px 40px", maxWidth: 880, margin: "0 auto" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 } satisfies CSSProperties,
  headerText: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  repo: { color: "var(--accent-text)" } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", marginTop: 3 } satisfies CSSProperties,
  toolbar: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 } satisfies CSSProperties,
  counter: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  toolbarEnd: { marginLeft: "auto" } satisfies CSSProperties,
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
  scanningRow: {
    padding: 16,
    marginBottom: 12,
    textAlign: "center",
    fontSize: 13,
    color: "var(--text-muted)",
    borderRadius: 9,
    border: "1px dashed var(--border-strong)",
  } satisfies CSSProperties,
  note: { fontSize: 13, color: "var(--text-muted)", margin: "8px 0 16px" } satisfies CSSProperties,
  skeletons: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
