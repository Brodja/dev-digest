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
vi.mock("@/lib/hooks/conventions", () => ({
  useConventions: () => ({ ...query, refetch }),
  useExtractConventions: () => extract,
  useUpdateConvention: () => update,
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
  refetch.mockReset();
  existingSkills = [];
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

  describe("several skills from different selections (P3)", () => {
    const ACCEPTED_2 = cand("a2", "Name files in kebab-case.", "accepted");
    const bodyOfModal = () => (screen.getByRole("textbox", { name: "Skill body" }) as HTMLTextAreaElement).value;
    const includeBox = (rule: string) =>
      within(screen.getByRole("article", { name: rule })).getByRole("checkbox", { name: "Include in skill" });

    beforeEach(() => {
      query = { data: { scan: scan(), candidates: [PENDING, ACCEPTED, ACCEPTED_2, REJECTED] }, isLoading: false, isError: false };
    });

    it("offers the checkbox on accepted cards only, all selected by default (main flow unchanged)", () => {
      renderView();
      expect(includeBox(ACCEPTED.rule)).toHaveAttribute("aria-checked", "true");
      expect(includeBox(ACCEPTED_2.rule)).toHaveAttribute("aria-checked", "true");
      expect(within(screen.getByRole("article", { name: PENDING.rule })).queryByRole("checkbox")).toBeNull();
      expect(within(screen.getByRole("article", { name: REJECTED.rule })).queryByRole("checkbox")).toBeNull();
      expect(screen.getByText("2 of 2 accepted selected for the skill")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Accept as Skill" }));
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("repo-conventions");
      expect(bodyOfModal()).toContain(ACCEPTED.rule);
      expect(bodyOfModal()).toContain(ACCEPTED_2.rule);
    });

    it("builds the skill from the selected subset only, and a second skill from another subset", () => {
      renderView();
      fireEvent.click(includeBox(ACCEPTED_2.rule));
      expect(screen.getByText("1 of 2 accepted selected for the skill")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Accept as Skill" }));
      expect(bodyOfModal()).toContain(ACCEPTED.rule);
      expect(bodyOfModal()).not.toContain(ACCEPTED_2.rule);
      fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
      expect(create.mutate.mock.calls[0]![0]).toMatchObject({ name: "repo-conventions", convention_ids: ["a1"] });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      // Second skill: the other convention, under another name (the first one now exists).
      existingSkills = [{ name: "repo-conventions" }];
      fireEvent.click(includeBox(ACCEPTED.rule));
      fireEvent.click(includeBox(ACCEPTED_2.rule));
      fireEvent.click(screen.getByRole("button", { name: "Accept as Skill" }));
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("repo-conventions-2");
      expect(bodyOfModal()).toContain(ACCEPTED_2.rule);
      expect(bodyOfModal()).not.toContain(ACCEPTED.rule);
      fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
      expect(create.mutate.mock.calls[1]![0]).toMatchObject({ name: "repo-conventions-2", convention_ids: ["a2"] });
    });

    it("disables Accept as Skill when nothing is selected", () => {
      renderView();
      fireEvent.click(includeBox(ACCEPTED.rule));
      fireEvent.click(includeBox(ACCEPTED_2.rule));
      expect(screen.getByText("0 of 2 accepted selected for the skill")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Accept as Skill" })).toBeDisabled();
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
