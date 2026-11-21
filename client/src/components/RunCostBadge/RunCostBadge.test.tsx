/**
 * RunCostBadge — the format table from server/specs/001-run-cost.md, plus the
 * two variants and the exact-USD tooltip used to cross-check the run's Live log.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import common from "../../../messages/en/common.json";
import { RunCostBadge } from "./RunCostBadge";
import { formatCost, totalTokens } from "./helpers";

afterEach(cleanup);

describe("formatCost", () => {
  it.each([
    [null, "—"],
    [undefined, "—"],
    [Number.NaN, "—"],
    [-0.01, "—"],
    [0, "$0"],
    [0.00004, "<$0.0001"],
    [0.0001, "$0.0001"],
    [0.000123456, "$0.000123"],
    [0.001, "$0.001"],
    [0.012, "$0.012"],
    [0.014, "$0.014"],
    [0.0814235, "$0.0814"],
    [0.12345, "$0.123"],
    [0.5, "$0.50"],
    [0.1 + 0.2, "$0.30"],
    [0.99951, "$1.00"],
    [1.2345, "$1.23"],
    [12.5, "$12.50"],
  ])("%s → %s", (usd, expected) => {
    expect(formatCost(usd)).toBe(expected);
  });

  it("never renders $0.00 for a missing cost", () => {
    expect(formatCost(null)).not.toBe("$0.00");
  });
});

describe("totalTokens", () => {
  it("sums in + out, null when both are unknown", () => {
    expect(totalTokens(8200, 919)).toBe(9119);
    expect(totalTokens(null, 50)).toBe(50);
    expect(totalTokens(null, undefined)).toBeNull();
  });
});

function renderBadge(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ common }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("RunCostBadge", () => {
  it("compact: cost only, exact USD in the tooltip", () => {
    renderBadge(<RunCostBadge costUsd={0.01412538} tokensIn={8200} tokensOut={1300} />);
    const badge = screen.getByTestId("run-cost");
    expect(badge).toHaveTextContent(/^\$0\.0141$/);
    expect(badge).toHaveAttribute("title", "$0.01412538");
  });

  it("detailed: total tokens · cost", () => {
    renderBadge(<RunCostBadge variant="detailed" costUsd={0.0814} tokensIn={8200} tokensOut={919} />);
    expect(screen.getByTestId("run-cost")).toHaveTextContent("9,119 tok · $0.0814");
  });

  it("detailed without token counts falls back to the cost alone", () => {
    renderBadge(<RunCostBadge variant="detailed" costUsd={0.0814} />);
    expect(screen.getByTestId("run-cost")).toHaveTextContent(/^\$0\.0814$/);
  });

  it("unknown cost: '—' with an explanatory tooltip", () => {
    renderBadge(<RunCostBadge costUsd={null} />);
    const badge = screen.getByTestId("run-cost");
    expect(badge).toHaveTextContent("—");
    expect(badge).toHaveAttribute("title", common.runCost.unknown);
  });
});
