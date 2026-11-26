import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate, Skill } from "@devdigest/shared";
import conventionsMessages from "../../../../../../../messages/en/conventions.json";
import skillsMessages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { ApiError } from "@/lib/api";

const mutate = vi.fn();
let pending = false;
vi.mock("@/lib/hooks/conventions", () => ({
  useCreateConventionSkill: () => ({ mutate, isPending: pending }),
}));
let skills: Skill[] = [];
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: skills }),
}));

import { CreateConventionSkillModal } from "./CreateConventionSkillModal";

const c = (id: string, rule: string): ConventionCandidate => ({
  id,
  rule,
  evidence_path: `src/${id}.ts`,
  evidence_snippet: "code",
  confidence: 0.8,
  accepted: true,
  status: "accepted",
  evidence_start_line: 4,
  evidence_end_line: 6,
  commit_sha: "abc",
  created_at: "2026-11-26T10:00:00.000Z",
});
const ACCEPTED = [c("a1", "Throw NotFoundError from services."), c("a2", "Name files in kebab-case.")];

beforeEach(() => {
  mutate.mockReset();
  pending = false;
  skills = [];
});
afterEach(cleanup);

function renderModal(onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: conventionsMessages, skills: skillsMessages }}>
      <ToastProvider>
        <CreateConventionSkillModal repoId="r1" repoName="acme/api" conventions={ACCEPTED} onClose={onClose} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return onClose;
}

describe("CreateConventionSkillModal", () => {
  it("prefills name, description and a body built from the accepted conventions; the type is locked", () => {
    renderModal();
    expect(screen.getByText("Create skill from conventions")).toBeInTheDocument();
    expect(screen.getByText(/Merged from 2 accepted conventions in acme\/api/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("repo-conventions");
    expect((screen.getByRole("textbox", { name: "Description" }) as HTMLInputElement).value).toContain("acme/api");
    const body = (screen.getByRole("textbox", { name: "Skill body" }) as HTMLTextAreaElement).value;
    expect(body).toContain("1. Throw NotFoundError from services.");
    expect(body).toContain("2. Name files in kebab-case.");
    expect(screen.getByTestId("skill-type-locked")).toHaveTextContent("convention");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("switch", { name: "Enabled" })).toHaveAttribute("aria-checked", "true");
    // The design's footer note, and why the body carries no code.
    expect(screen.getByText("Saved as v1 · added to Skills Lab")).toBeInTheDocument();
    expect(screen.getByText(/Code from the repository stays out on purpose/)).toBeInTheDocument();
  });

  it("sends Enabled as switched (off → the skill starts disabled)", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(mutate.mock.calls[0]![0]).toMatchObject({ enabled: true });
    fireEvent.click(screen.getByRole("switch", { name: "Enabled" }));
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(mutate.mock.calls[1]![0]).toMatchObject({ enabled: false });
  });

  it("uses a free name when repo-conventions already exists", () => {
    skills = [{ name: "repo-conventions" } as Skill];
    renderModal();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("repo-conventions-2");
  });

  type Opts = { onSuccess: (s: { name: string }) => void; onError: (e: unknown) => void };

  it("Create skill sends the edited fields and the convention ids, then toasts and closes", () => {
    mutate.mockImplementation((_payload, opts: Opts) => opts.onSuccess({ name: "api-house-rules" }));
    const onClose = renderModal();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "api-house-rules" } });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    const [payload] = mutate.mock.calls[0]!;
    expect(payload).toMatchObject({ name: "api-house-rules", convention_ids: ["a1", "a2"] });
    expect(payload.body).toContain("Throw NotFoundError from services.");
    expect(screen.getByText(/Skill “api-house-rules” created/)).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a taken name inline (409)", () => {
    mutate.mockImplementation((_payload, opts: Opts) => opts.onError(new ApiError("taken", 409, "skill_name_taken")));
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(screen.getByText("A skill with this name already exists.")).toBeInTheDocument();
  });

  it("explains a convention that is no longer accepted (422)", () => {
    mutate.mockImplementation((_payload, opts: Opts) =>
      opts.onError(new ApiError("no", 422, "conventions_not_accepted")),
    );
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/no longer accepted/);
  });

  it("freezes the convention ids with the draft when it opens (a refetch while open changes neither)", () => {
    const modal = (conventions: ConventionCandidate[]) => (
      <NextIntlClientProvider locale="en" messages={{ conventions: conventionsMessages, skills: skillsMessages }}>
        <ToastProvider>
          <CreateConventionSkillModal repoId="r1" repoName="acme/api" conventions={conventions} onClose={vi.fn()} />
        </ToastProvider>
      </NextIntlClientProvider>
    );
    const { rerender } = render(modal(ACCEPTED));
    // The page refetched: a2 is no longer in the selected list.
    rerender(modal([ACCEPTED[0]!]));
    expect(screen.getByText(/Merged from 2 accepted conventions/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    const [payload] = mutate.mock.calls[0]!;
    expect(payload.convention_ids).toEqual(["a1", "a2"]);
    expect(payload.body).toContain("Name files in kebab-case.");
  });

  it("blocks a blank body and sends nothing; Cancel sends nothing", () => {
    const onClose = renderModal();
    fireEvent.change(screen.getByRole("textbox", { name: "Skill body" }), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Body is required.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});
