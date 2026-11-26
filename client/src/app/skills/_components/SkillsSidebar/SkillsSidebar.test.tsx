import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const update = vi.fn();
let list: Skill[] = [];
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: list, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
  useCreateSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useImportSkillPreview: () => ({ mutate: vi.fn(), isPending: false }),
  useImportSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SkillsSidebar } from "./SkillsSidebar";

const skill = (over: Partial<Skill>): Skill => ({
  id: "s1",
  name: "secret-leakage-gate",
  description: "Flag secrets.",
  type: "security",
  source: "manual",
  body: "- rules",
  enabled: true,
  version: 1,
  evidence_files: null,
  trusted: true,
  ...over,
});

beforeEach(() => {
  list = [
    skill({}),
    skill({ id: "s2", name: "pr-quality-rubric", description: "Score PR quality.", type: "rubric", body: "# Rubric body" }),
  ];
  update.mockReset();
  push.mockReset();
});
afterEach(cleanup);

function renderSidebar(props: { activeId?: string; tab?: string } = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <ToastProvider>
        <SkillsSidebar {...props} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("SkillsSidebar (Skills Lab list)", () => {
  it("lists a card per skill and marks the open one", () => {
    renderSidebar({ activeId: "s2" });
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "secret-leakage-gate" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "pr-quality-rubric" })).toHaveAttribute("aria-current", "page");
  });

  it("filters by the search box", () => {
    renderSidebar();
    fireEvent.change(screen.getByRole("textbox", { name: "Search skills…" }), { target: { value: "rubric" } });
    expect(screen.queryByRole("button", { name: "secret-leakage-gate" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pr-quality-rubric" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search skills…" }), { target: { value: "zzz" } });
    expect(screen.getByText("No skills match “zzz”.")).toBeInTheDocument();
  });

  it("a card opens the skill's page, keeping the current tab", () => {
    renderSidebar({ activeId: "s1", tab: "versions" });
    fireEvent.click(screen.getByRole("button", { name: "pr-quality-rubric" }));
    expect(push).toHaveBeenCalledWith("/skills/s2?tab=versions");
  });

  it("the card toggle saves enabled without opening the skill", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("switch", { name: /Enable pr-quality-rubric/ }));
    expect(update).toHaveBeenCalledWith({ id: "s2", patch: { enabled: false } }, expect.anything());
    expect(push).not.toHaveBeenCalled();
  });

  it("a failed toggle shows an error toast", async () => {
    update.mockImplementation((_input, opts: { onError?: (e: unknown) => void }) => opts.onError?.(new Error("boom")));
    renderSidebar();
    fireEvent.click(screen.getByRole("switch", { name: /Enable pr-quality-rubric/ }));
    expect(await screen.findByText("Could not switch “pr-quality-rubric”: boom")).toBeInTheDocument();
  });

  it("Add Skill → Create from scratch opens the create modal", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /Add Skill/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create from scratch" }));
    expect(within(screen.getByRole("dialog")).getByText("Create skill")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
  });

  it("Add Skill → Import from file opens the import modal", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /Add Skill/ }));
    fireEvent.click(screen.getByRole("button", { name: "Import from file" }));
    expect(within(screen.getByRole("dialog")).getByText("Import skill")).toBeInTheDocument();
    expect(screen.getByLabelText("Skill file")).toBeInTheDocument();
  });

  it("shows the empty state when the workspace has no skills", () => {
    list = [];
    renderSidebar();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
  });
});
