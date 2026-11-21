import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

const base = FINDINGS[0]!;
const finding = (over: Partial<FindingRecord>): FindingRecord => ({ ...base, ...over });

/** 1 CRITICAL, 3 WARNING (one below the 0.65 low-confidence threshold), 1 SUGGESTION. */
const MIXED: FindingRecord[] = [
  finding({ id: "c1", severity: "CRITICAL", title: "Crit one", confidence: 0.95 }),
  finding({ id: "w1", severity: "WARNING", title: "Warn one", confidence: 0.9 }),
  finding({ id: "w2", severity: "WARNING", title: "Warn two", confidence: 0.8 }),
  finding({ id: "w3", severity: "WARNING", title: "Warn low", confidence: 0.5 }),
  finding({ id: "s1", severity: "SUGGESTION", title: "Sugg one", confidence: 0.7 }),
];

const ALL_TITLES = ["Crit one", "Warn one", "Warn two", "Warn low", "Sugg one"];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

/** Counter pill by its accessible name ("3 Warning"; uppercase is CSS-only). */
const pill = (name: string) => screen.getByRole("button", { name });
const titlesShown = () => ALL_TITLES.filter((t) => screen.queryByText(t) !== null);

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

describe("FindingsPanel severity counters", () => {
  it("counts findings per severity level", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    expect(pill("1 Critical")).toBeInTheDocument();
    expect(pill("3 Warning")).toBeInTheDocument();
    expect(pill("1 Suggestion")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /info/i })).toBeNull();
  });

  it("hides a level with no findings and keeps the toggle", () => {
    const noCritical = MIXED.filter((f) => f.severity !== "CRITICAL");
    renderWithIntl(<FindingsPanel findings={noCritical} prId="pr1" />);
    expect(screen.queryByRole("button", { name: /critical/i })).toBeNull();
    expect(pill("3 Warning")).toBeInTheDocument();
    expect(pill("1 Suggestion")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("filters by a level and clears on a second click", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);

    fireEvent.click(pill("3 Warning"));
    expect(pill("3 Warning")).toHaveAttribute("aria-pressed", "true");
    expect(titlesShown()).toEqual(["Warn one", "Warn two", "Warn low"]);

    fireEvent.click(pill("3 Warning"));
    expect(pill("3 Warning")).toHaveAttribute("aria-pressed", "false");
    expect(titlesShown()).toEqual(ALL_TITLES);
  });

  it("dims the inactive pills only while a filter is active", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    for (const name of ["1 Critical", "3 Warning", "1 Suggestion"]) {
      expect(pill(name)).toHaveStyle({ opacity: "1" });
    }

    fireEvent.click(pill("3 Warning"));
    expect(pill("3 Warning")).toHaveStyle({ opacity: "1" });
    expect(pill("1 Critical")).toHaveStyle({ opacity: "0.5" });
    expect(pill("1 Suggestion")).toHaveStyle({ opacity: "0.5" });
  });

  it("keeps only one level active at a time", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(pill("3 Warning"));
    fireEvent.click(pill("1 Critical"));
    expect(pill("1 Critical")).toHaveAttribute("aria-pressed", "true");
    expect(pill("3 Warning")).toHaveAttribute("aria-pressed", "false");
    expect(titlesShown()).toEqual(["Crit one"]);
  });

  it("combines with Hide low confidence", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(pill("3 Warning"));
    fireEvent.click(screen.getByRole("switch"));

    expect(pill("2 Warning")).toHaveAttribute("aria-pressed", "true");
    expect(pill("1 Critical")).toBeInTheDocument();
    expect(pill("1 Suggestion")).toBeInTheDocument();
    expect(titlesShown()).toEqual(["Warn one", "Warn two"]);
  });

  it("keeps an emptied active level clickable and shows the empty state", () => {
    const lowWarnings = [
      finding({ id: "c1", severity: "CRITICAL", title: "Crit one", confidence: 0.95 }),
      finding({ id: "w3", severity: "WARNING", title: "Warn low", confidence: 0.5 }),
    ];
    renderWithIntl(<FindingsPanel findings={lowWarnings} prId="pr1" />);
    fireEvent.click(pill("1 Warning"));
    fireEvent.click(screen.getByRole("switch"));

    expect(pill("0 Warning")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("No findings match")).toBeInTheDocument();

    fireEvent.click(pill("0 Warning"));
    expect(screen.queryByRole("button", { name: /warning/i })).toBeNull();
    expect(titlesShown()).toEqual(["Crit one"]);
  });

  it("stays in sync with the list after accept/dismiss refetches", () => {
    const { rerender } = renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    const refetched = MIXED.map((f) =>
      f.id === "w1" ? { ...f, dismissed_at: "2026-11-21T10:00:00Z" } : f,
    );
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={refetched} prId="pr1" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("dismissed")).toBeInTheDocument();
    expect(pill("3 Warning")).toBeInTheDocument();
    expect(titlesShown()).toEqual(ALL_TITLES);
  });
});
