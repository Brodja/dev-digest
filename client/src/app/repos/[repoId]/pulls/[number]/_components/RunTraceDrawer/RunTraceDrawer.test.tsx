import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunTrace } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/runs.json"; // apps/web/messages/en/runs.json
import common from "../../../../../../../../messages/en/common.json";

// Mock the trace hooks so the drawer renders without a query client / SSE.
// Stored before the run-cost feature: stats has NO cost_usd key.
const TRACE: RunTrace = {
  config: { agent: "Security", version: "1", provider: "openai", model: "gpt-4.1", pr: 482, source: "local" },
  stats: { duration_ms: 8200, tokens_in: 12000, tokens_out: 1500, findings: 2, grounding: "2/2 passed" },
  prompt_assembly: { system: "You are a reviewer.", skills: "### skill", memory: null, specs: null, user: "Review PR #482" },
  tool_calls: [{ tool: "review_file", args: "src/config.ts", meta: "single-pass", ms: 1200 }],
  raw_output: '{"verdict":"request_changes"}',
  memory_pulled: [{ pr: 471, text: "rate-limit public endpoints" }],
  specs_read: [],
  log: [
    { t: "00.10", kind: "info", msg: "Starting review with agent Security" },
    { t: "00.90", kind: "result", msg: "Citation grounding: 2/2 passed" },
  ],
};

let currentTrace: RunTrace = TRACE;
vi.mock("../../../../../../../lib/hooks/trace", () => ({
  useRunTrace: () => ({ data: currentTrace, isLoading: false }),
}));
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useRunEvents: () => ({ events: [], running: false }),
}));

import RunTraceDrawer from "./RunTraceDrawer";

afterEach(() => {
  cleanup();
  currentTrace = TRACE;
});

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages, common }}>
      <div data-theme="dark">{ui}</div>
    </NextIntlClientProvider>,
  );
}

describe("A5 Run Trace drawer (smoke)", () => {
  it("renders the trace tabs and stats", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Stats")).toBeInTheDocument();
    expect(screen.getByText("2/2 passed")).toBeInTheDocument();
    expect(screen.getByText("Tool calls")).toBeInTheDocument();
  });

  it("switches to the live log tab", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    fireEvent.click(screen.getByText("log"));
    // LiveLogStream renders its filter input
    expect(screen.getByPlaceholderText("Filter log…")).toBeInTheDocument();
  });
});

describe("Run Trace drawer — COST stat", () => {
  it("shows the run cost between TOKENS and FINDINGS, exact USD in the tooltip", () => {
    currentTrace = { ...TRACE, stats: { ...TRACE.stats, cost_usd: 0.0123456 } };
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    const labels = screen.getAllByText(/^(DURATION|TOKENS|COST|FINDINGS)$/).map((el) => el.textContent);
    expect(labels).toEqual(["DURATION", "TOKENS", "COST", "FINDINGS"]);
    const badge = screen.getByTestId("run-cost");
    expect(badge).toHaveTextContent("$0.0123");
    expect(badge).toHaveAttribute("title", "$0.0123456");
  });

  it("a trace stored before the feature (no cost_usd) shows '—'", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    expect(screen.getByTestId("run-cost")).toHaveTextContent("—");
  });
});

describe("Run Trace drawer — skills block in Prompt assembly", () => {
  const openPromptAssembly = () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Prompt assembly"));
  };

  it("shows the block, the tokens it added and each skill sent, untrusted marked", () => {
    currentTrace = {
      ...TRACE,
      config: {
        ...TRACE.config,
        skills: [
          { id: "s2", name: "owasp-top10", version: 1, trusted: false, tokens: 40 },
          { id: "s1", name: "l02-secrets-gate", version: 3, trusted: true, tokens: 52 },
        ],
      },
      prompt_assembly: { ...TRACE.prompt_assembly, skills: "### owasp-top10 …", skills_tokens: 94 },
    };
    openPromptAssembly();
    expect(screen.getByText("Skills — enabled skill bodies")).toBeInTheDocument();
    expect(screen.getByText("94 tokens")).toBeInTheDocument();
    const chips = screen.getAllByTestId("trace-skill");
    expect(chips.map((c) => c.textContent)).toEqual(["owasp-top10· 40 tok", "l02-secrets-gate· 52 tok"]);
    expect(chips[0]).toHaveAttribute("title", "Imported skill — sent as untrusted data");
    expect(screen.getByLabelText("untrusted")).toBeInTheDocument();
    expect(screen.queryByText(/sent with each of/)).not.toBeInTheDocument();
  });

  it("map-reduce: says the block went with every call", () => {
    currentTrace = {
      ...TRACE,
      tool_calls: [
        { tool: "review_file", args: "a.ts", meta: "map-reduce", ms: 1 },
        { tool: "review_file", args: "b.ts", meta: "map-reduce", ms: 1 },
      ],
      prompt_assembly: { ...TRACE.prompt_assembly, skills_tokens: 10 },
    };
    openPromptAssembly();
    expect(screen.getByText("sent with each of 2 calls")).toBeInTheDocument();
  });

  it("an old trace (no counts) shows the block without numbers; no skills → no block", () => {
    openPromptAssembly();
    expect(screen.getByText("Skills — enabled skill bodies")).toBeInTheDocument();
    expect(screen.queryByText(/tokens$/)).not.toBeInTheDocument();
    cleanup();

    currentTrace = { ...TRACE, prompt_assembly: { ...TRACE.prompt_assembly, skills: null } };
    openPromptAssembly();
    expect(screen.queryByText("Skills — enabled skill bodies")).not.toBeInTheDocument();
  });
});
