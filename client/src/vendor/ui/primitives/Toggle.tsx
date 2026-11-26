import React from "react";

/**
 * On/off switch. `type="button"` so it never submits a surrounding <form>;
 * `label` gives it an accessible name (role="switch" needs one).
 * onChange gets no event: to keep a click from reaching a clickable parent,
 * stop propagation on a wrapper element.
 */
export function Toggle({
  on,
  onChange,
  size = 18,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  size?: number;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      style={{
        width: size * 1.85,
        height: size + 4,
        borderRadius: 99,
        border: "none",
        padding: 2,
        background: on ? "var(--accent)" : "var(--border-strong)",
        transition: "background .15s",
        position: "relative",
      }}
    >
      <span
        style={{
          display: "block",
          width: size,
          height: size,
          borderRadius: 99,
          background: "#fff",
          transform: on ? `translateX(${size * 0.85}px)` : "none",
          transition: "transform .15s",
          boxShadow: "0 1px 3px rgba(0,0,0,.3)",
        }}
      />
    </button>
  );
}
