import { describe, it, expect } from "vitest";
import { acceptRateColor, formatRate } from "./helpers";

describe("Skills Lab helpers", () => {
  it("formats a 0..1 rate as a whole percent, and no data as a dash", () => {
    expect(formatRate(0.254)).toBe("25%");
    expect(formatRate(1)).toBe("100%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(null)).toBe("—");
    expect(formatRate(undefined)).toBe("—");
  });

  it("colours the accept rate green from 60%, amber below, muted without data", () => {
    expect(acceptRateColor(0.6)).toBe("var(--ok)");
    expect(acceptRateColor(0.59)).toBe("var(--warn)");
    expect(acceptRateColor(null)).toBe("var(--text-muted)");
  });
});
