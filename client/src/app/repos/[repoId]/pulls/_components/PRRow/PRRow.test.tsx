/**
 * PRRow — the COST column shows the cost of the run behind the PR's latest
 * review, and "—" (never "$0.00") when the PR was never reviewed or the cost
 * is unknown.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@/lib/types";
import prReview from "../../../../../../../messages/en/prReview.json";
import common from "../../../../../../../messages/en/common.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { PRRow } from "./PRRow";

afterEach(cleanup);

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    id: "pr-1",
    number: 482,
    title: "Add rate limiting to public API endpoints",
    author: "marisa.koch",
    branch: "feat/rate-limit-public",
    base: "main",
    head_sha: "abc123",
    additions: 247,
    deletions: 38,
    files_count: 9,
    status: "needs_review",
    opened_at: null,
    updated_at: null,
    score: null,
    cost_usd: null,
    ...o,
  };
}

function renderRow(p: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview, common }}>
      <PRRow pr={p} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow — COST column", () => {
  it("a reviewed PR shows the latest review's run cost", () => {
    renderRow(pr({ score: 61, cost_usd: 0.014 }));
    const badge = screen.getByTestId("run-cost");
    expect(badge).toHaveTextContent(/^\$0\.014$/);
    expect(badge).toHaveAttribute("title", "$0.014");
  });

  it("a never-reviewed PR shows '—'", () => {
    renderRow(pr({ score: null, cost_usd: null }));
    expect(screen.getByTestId("run-cost")).toHaveTextContent("—");
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });

  it("a reviewed PR whose run has no price shows '—'", () => {
    renderRow(pr({ score: 72, cost_usd: undefined }));
    expect(screen.getByTestId("run-cost")).toHaveTextContent("—");
  });
});
