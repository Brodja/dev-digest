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
const create = { mutate: vi.fn(), isPending: false };
const bulk = { mutate: vi.fn(), isPending: false };
vi.mock("@/lib/hooks/conventions", () => ({
  useConventions: () => ({ ...query, refetch }),
  useExtractConventions: () => extract,
  useUpdateConvention: () => update,
  useSetConventionStatuses: () => bulk,
  useCreateConventionSkill: () => create,
}));
let existingSkills: { name: string }[] = [];
vi.mock("@/lib/hooks/skills", () => ({ useSkills: () => ({ data: existingSkills }) }));

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
  create.mutate.mockReset();
  bulk.mutate.mockReset();
  bulk.isPending = false;
  refetch.mockReset();
  existingSkills = [];
});
afterEach(cleanup);

const ui = () => (
  <NextIntlClientProvider locale="en" messages={{ conventions: conventionsMessages, skills: skillsMessages }}>
    <ToastProvider>
      <ConventionsView repoId="r1" />
    </ToastProvider>
  </NextIntlClientProvider>
);

function renderView() {
  return render(ui());
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

  const order = () =>
    within(screen.getByRole("list", { name: "Convention candidates" }))
      .getAllByRole("article")
      .map((a) => a.getAttribute("aria-label"));

  it("lists every candidate in one list, with the scan summary and the accepted count", () => {
    // The server sorts by status (pending → accepted → rejected); the page does not.
    query = { data: { scan: scan(), candidates: [PENDING, ACCEPTED, REJECTED] }, isLoading: false, isError: false };
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Conventions in acme/api");
    expect(screen.getByText(/3 candidates · grounded against sampled files · 16 sampled files · last scan 5 minutes ago · 1 proposal dropped without evidence/)).toBeInTheDocument();
    // Same confidence and age here → by rule.
    expect(order()).toEqual([ACCEPTED.rule, REJECTED.rule, PENDING.rule]);
    expect(screen.queryByRole("region", { name: "To review" })).toBeNull();
    expect(screen.getByText("1 of 3 accepted")).toBeInTheDocument();
    // The rejected card stays in place, marked.
    expect(within(screen.getByRole("article", { name: REJECTED.rule })).getByRole("button", { name: "Rejected" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("a decision does not move the card (the order ignores the status)", () => {
    const { rerender } = renderView();
    const before = order();
    fireEvent.click(within(screen.getByRole("article", { name: PENDING.rule })).getByRole("button", { name: "Accept" }));
    // The refetch comes back sorted by status on the server: accepted after pending.
    const p1 = { ...PENDING, status: "accepted" as const, accepted: true };
    query = { data: { scan: scan(), candidates: [ACCEPTED, p1, REJECTED] }, isLoading: false, isError: false };
    rerender(ui());
    expect(order()).toEqual(before);
  });

  it("Select all accepts every candidate still to review (not the rejected ones)", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(bulk.mutate).toHaveBeenCalledWith({ ids: ["p1"], status: "accepted" }, expect.anything());
  });

  it("with nothing left to review, Deselect all moves the accepted ones back; only rejected → no toggle", () => {
    query = { data: { scan: scan(), candidates: [ACCEPTED, REJECTED] }, isLoading: false, isError: false };
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(bulk.mutate).toHaveBeenCalledWith({ ids: ["a1"], status: "pending" }, expect.anything());
    cleanup();
    query = { data: { scan: scan(), candidates: [REJECTED] }, isLoading: false, isError: false };
    renderView();
    expect(screen.queryByRole("button", { name: /Select all|Deselect all/ })).toBeNull();
  });

  it("says how many conventions a bulk change could not update", async () => {
    bulk.mutate.mockImplementation((_input, opts: { onSuccess: (r: { failed: number; total: number }) => void }) =>
      opts.onSuccess({ failed: 1, total: 2 }),
    );
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(await screen.findByText("Could not update 1 of 2 conventions — try again.")).toBeInTheDocument();
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
    expect(screen.getByText("Scanning repository…")).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", { name: "Accept as Skill" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select all" })).toBeDisabled();
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

  describe("several skills from different accepted sets (P3)", () => {
    const ACCEPTED_2 = cand("a2", "Name files in kebab-case.", "accepted");
    const bodyOfModal = () => (screen.getByRole("textbox", { name: "Skill body" }) as HTMLTextAreaElement).value;

    beforeEach(() => {
      query = { data: { scan: scan(), candidates: [PENDING, ACCEPTED, ACCEPTED_2, REJECTED] }, isLoading: false, isError: false };
    });

    it("the accepted set is the skill: no per-card selection", () => {
      renderView();
      expect(screen.queryByRole("checkbox", { name: "Include in skill" })).toBeNull();
      expect(screen.getByText("2 of 4 accepted")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Accept as Skill" }));
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("repo-conventions");
      expect(bodyOfModal()).toContain(ACCEPTED.rule);
      expect(bodyOfModal()).toContain(ACCEPTED_2.rule);
      expect(bodyOfModal()).not.toContain(PENDING.rule);
      expect(bodyOfModal()).not.toContain(REJECTED.rule);
    });

    it("builds a skill, then — after the accepted set changes — a second one under a free name", () => {
      const { rerender } = renderView();
      fireEvent.click(screen.getByRole("button", { name: "Accept as Skill" }));
      fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
      // List order: "Name files…" before "Throw NotFoundError…".
      expect(create.mutate.mock.calls[0]![0]).toMatchObject({ name: "repo-conventions", convention_ids: ["a2", "a1"] });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      // Change the set: a2 back to review, p1 accepted; the first skill now exists.
      fireEvent.click(within(screen.getByRole("article", { name: ACCEPTED_2.rule })).getByRole("button", { name: "Accepted" }));
      expect(update.mutate).toHaveBeenLastCalledWith({ id: "a2", patch: { status: "pending" } });
      fireEvent.click(within(screen.getByRole("article", { name: PENDING.rule })).getByRole("button", { name: "Accept" }));
      expect(update.mutate).toHaveBeenLastCalledWith({ id: "p1", patch: { status: "accepted" } });
      const p1 = { ...PENDING, status: "accepted" as const, accepted: true };
      const a2 = { ...ACCEPTED_2, status: "pending" as const, accepted: false };
      query = { data: { scan: scan(), candidates: [p1, ACCEPTED, a2, REJECTED] }, isLoading: false, isError: false };
      existingSkills = [{ name: "repo-conventions" }];
      rerender(ui());

      fireEvent.click(screen.getByRole("button", { name: "Accept as Skill" }));
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("repo-conventions-2");
      expect(bodyOfModal()).toContain(PENDING.rule);
      expect(bodyOfModal()).toContain(ACCEPTED.rule);
      expect(bodyOfModal()).not.toContain(ACCEPTED_2.rule);
      fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
      expect(create.mutate.mock.calls[1]![0]).toMatchObject({ name: "repo-conventions-2", convention_ids: ["a1", "p1"] });
    });
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
