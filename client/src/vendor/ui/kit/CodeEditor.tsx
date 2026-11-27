import React from "react";
import { Icon } from "../icons";

/**
 * Plain-text code editor: a file header (name, a status badge such as
 * "unsaved", a right-aligned meta such as a token count), a line-number gutter
 * and a REAL controlled <textarea>. Lines never wrap, so each gutter number
 * stays next to its line; the body scrolls the gutter and the text together.
 * Extra props (aria-label, aria-invalid, …) go to the textarea.
 */
export function CodeEditor({
  value,
  onChange,
  filename,
  status,
  meta,
  height = 360,
  placeholder,
  ...rest
}: {
  value: string;
  onChange?: (v: string) => void;
  filename?: string;
  /** Shown as a small badge after the file name (e.g. "unsaved"). */
  status?: React.ReactNode;
  /** Right side of the header (e.g. "~120 tokens"). */
  meta?: React.ReactNode;
  /** Height of the scrolling body, px. */
  height?: number;
  placeholder?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "rows" | "wrap">) {
  const lines = value.split("\n");
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);

  return (
    <div style={s.frame}>
      {(filename || status || meta) && (
        <div style={s.header}>
          <Icon.FileText size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          {filename && (
            <span className="mono" style={s.filename}>
              {filename}
            </span>
          )}
          {status && <span style={s.status}>{status}</span>}
          {meta && (
            <span className="mono" style={s.meta}>
              {meta}
            </span>
          )}
        </div>
      )}
      <div style={{ ...s.body, height }}>
        <div aria-hidden="true" className="mono tnum" style={s.gutter}>
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          {...rest}
          className="mono"
          wrap="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          style={{
            ...s.text,
            // Tall and wide enough for every line, so the body (not the
            // textarea) scrolls and the gutter moves with the text.
            height: lines.length * LINE_HEIGHT + PAD_Y * 2,
            width: `max(100%, ${longest + 4}ch)`,
          }}
        />
      </div>
    </div>
  );
}

const LINE_HEIGHT = 21;
const PAD_Y = 10;

const s = {
  frame: {
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    overflow: "hidden",
    background: "var(--bg-surface)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 14px",
    borderBottom: "1px solid var(--border)",
    minWidth: 0,
  },
  filename: {
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  status: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--warn)",
    background: "var(--warn-bg)",
    padding: "1px 7px",
    borderRadius: 4,
    flexShrink: 0,
  },
  meta: { marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 },
  body: { display: "flex", overflow: "auto", alignItems: "flex-start" },
  gutter: {
    flexShrink: 0,
    width: 44,
    padding: `${PAD_Y}px 12px ${PAD_Y}px 0`,
    textAlign: "right",
    fontSize: 12.5,
    lineHeight: `${LINE_HEIGHT}px`,
    color: "var(--text-muted)",
    userSelect: "none",
    position: "sticky",
    left: 0,
    background: "var(--bg-surface)",
  },
  text: {
    flex: "1 0 auto",
    minHeight: "100%",
    resize: "none",
    overflow: "hidden",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 12.5,
    lineHeight: `${LINE_HEIGHT}px`,
    padding: `${PAD_Y}px 12px ${PAD_Y}px 2px`,
    whiteSpace: "pre",
    tabSize: 2,
  },
} satisfies Record<string, React.CSSProperties>;
