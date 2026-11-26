import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate, ConventionScan, ConventionsState } from "@devdigest/shared";
import conventionsMessages from "../../../../../../../messages/en/conventions.json";
import skillsMessages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { ApiError } from "@/lib/api";

// The page shell needs routing; the view under test is its content.
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/repo-not-found", () => ({ RepoNotFound: () => <div>No repository selected</div> }));

let notFound = false;
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ activeRepo: { id: "r1", full_name: "acme/api", default_branch: "main" } }),
  useRepoNotFound: () => notFound,
}));

let query: { data?: ConventionsState; isLoading: boolean; isError: boolean };
const refetch = vi.fn();
const extract = { mutate: vi.fn(), isPending: false, isError: false, error: null as Error | null };
const update = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})) };
vi.mock("@/lib/hooks/conventions", () => ({
  useConventions: () => ({ ...query, refetch }),
  useExtractConventions: () => extract,
  useUpdateConvention: () => update,
  useCreateConventionSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/hooks/skills", () => ({ useSkills: () => ({ data: [] }) }));

import { ConventionsView } from "./ConventionsView";

const scan = (over: Partial<ConventionScan> = {}): ConventionScan => ({
  id: "s1",
  status: "succeeded",
  error_code: null,
  error_message: null,
  provider: "openrouter",
  model: "deepseek/deepseek-v4-flash",
  commit_sha: "abc",
  files: Array.from({ length: 16 }, (_, i) => `f${i}.ts`),
  proposed: 12,
  kept: 3,
  dropped_ungrounded: 1,
  dropped_duplicate: 0,
  tokens_in: 100,
  tokens_out: 50,
  attempts: 1,
  cost_usd: 0.002,
  started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  finished_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  ...over,
});

const cand = (id: string, rule: string, status: ConventionCandidate["status"]): ConventionCandidate => ({
  id,
  rule,
  evidence_path: `src/${id}.ts`,
  evidence_snippet: `export const ${id} = 1;`,
  confidence: 0.9,
  accepted: status === "accepted",
  status,
  evidence_start_line: 3,
  evidence_end_line: 4,
  commit_sha: "abc",
  created_at: "2026-11-26T10:00:00.000Z",
});
const PENDING = cand("p1", "Validate route bodies with Zod.", "pending");
const ACCEPTED = cand("a1", "Throw NotFoundError from services.", "accepted");
const REJECTED = cand("x1", "Use semicolons everywhere.", "rejected");

beforeEach(() => {
  notFound = false;
  query = { data: { scan: scan(), candidates: [PENDING, ACCEPTED, REJECTED] }, isLoading: false, isError: false };
  Object.assign(extract, { isPending: false, isError: false, error: null });
  extract.mutate.mockReset();
  update.mutate.mockReset();
  refetch.mockReset();
});
afterEach(cleanup);

function renderView() {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: conventionsMessages, skills: skillsMessages }}>
      <ToastProvider>
        <ConventionsView repoId="r1" />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("ConventionsView (/repos/:repoId/conventions)", () => {
  it("shows the empty state until the first scan; Run extraction starts one", () => {
    query = { data: { scan: null, candidates: [] }, isLoading: false, isError: false };
    renderView();
    expect(screen.getByText("No conventions extracted yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Re-scan" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Run extraction" }));
    expect(extract.mutate).toHaveBeenCalledTimes(1);
  });

  it("lists candidates grouped by status, with the scan summary", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Conventions in acme/api");
    expect(screen.getByText(/3 candidates · grounded against sampled files · 16 sampled files · last scan 5 minutes ago · 1 proposal dropped without evidence/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "To review" })).getByText(PENDING.rule)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Accepted" })).getByText(ACCEPTED.rule)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Rejected" })).getByText(REJECTED.rule)).toBeInTheDocument();
  });

  it("Accept on a card sends the status for that candidate", () => {
    renderView();
    const card = screen.getByRole("article", { name: PENDING.rule });
    fireEvent.click(within(card).getByRole("button", { name: "Accept" }));
    expect(update.mutate).toHaveBeenCalledWith({ id: "p1", patch: { status: "accepted" } });
  });

  it("Re-scan runs a scan and shows Scanning… while it runs", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Re-scan" }));
    expect(extract.mutate).toHaveBeenCalledTimes(1);
    cleanup();
    extract.isPending = true;
    renderView();
    expect(screen.getByRole("button", { name: "Scanning…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Accept as Skill" })).toBeDisabled();
  });

  it("Accept as Skill is disabled without accepted conventions, and opens the modal with the accepted ones only", () => {
    query = { data: { scan: scan(), candidates: [PENDING, REJECTED] }, isLoading: false, isError: false };
    renderView();
    expect(screen.getByRole("button", { name: "Accept as Skill" })).toBeDisabled();
    cleanup();

    query = { data: { scan: scan(), candidates: [PENDING, ACCEPTED, REJECTED] }, isLoading: false, isError: false };
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Accept as Skill" }));
    expect(screen.getByText("Create skill from conventions")).toBeInTheDocument();
    const body = (screen.getByRole("textbox", { name: "Skill body" }) as HTMLTextAreaElement).value;
    expect(body).toContain(ACCEPTED.rule);
    expect(body).not.toContain(PENDING.rule);
    expect(body).not.toContain(REJECTED.rule);
  });

  it("explains a failed last scan (stored) in the page's words", () => {
    query = {
      data: { scan: scan({ status: "failed", error_code: "repo_not_indexed", error_message: "raw" }), candidates: [] },
      isLoading: false,
      isError: false,
    };
    renderView();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Extraction failed");
    expect(alert).toHaveTextContent(/no index to sample files from yet/);
    expect(screen.getByText(/Scan the cloned repo to surface house-rules/)).toBeInTheDocument(); // subtitle fallback
  });

  it("shows the server's message for a failed request with an unmapped code", () => {
    Object.assign(extract, {
      isError: true,
      error: new ApiError("The model call failed: upstream 503", 502, "llm_failed"),
    });
    renderView();
    expect(screen.getByRole("alert")).toHaveTextContent("The model call failed: upstream 503");
  });

  it("notes a succeeded scan that grounded nothing", () => {
    query = { data: { scan: scan({ kept: 0 }), candidates: [] }, isLoading: false, isError: false };
    renderView();
    expect(screen.getByText(/found no convention it could back with evidence/)).toBeInTheDocument();
  });

  it("load error → retry; loading → no list", () => {
    query = { isLoading: false, isError: true };
    renderView();
    expect(screen.getByText("Could not load conventions.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
    cleanup();
    query = { isLoading: true, isError: false };
    renderView();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("an unknown repo shows RepoNotFound", () => {
    notFound = true;
    renderView();
    expect(screen.getByText("No repository selected")).toBeInTheDocument();
  });
});
