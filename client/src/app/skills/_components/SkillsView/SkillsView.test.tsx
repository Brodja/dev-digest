import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

// The page shell needs repo context / routing; the view under test is its content.
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const update = vi.fn();
let list: Skill[] = [];
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: list, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
  useCreateSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useSkill: (id: string) => ({
    data: { ...list.find((s) => s.id === id)!, used_by: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useDeleteSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useImportSkillPreview: () => ({ mutate: vi.fn(), isPending: false }),
  useImportSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SkillsView } from "./SkillsView";

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
});
afterEach(cleanup);

function renderView() {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <ToastProvider>
        <SkillsView />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("SkillsView (/skills)", () => {
  it("renders a card per skill", () => {
    renderView();
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "secret-leakage-gate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pr-quality-rubric" })).toBeInTheDocument();
  });

  it("filters by the search box", () => {
    renderView();
    fireEvent.change(screen.getByRole("textbox", { name: "Search skills…" }), { target: { value: "rubric" } });
    expect(screen.queryByRole("button", { name: "secret-leakage-gate" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pr-quality-rubric" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search skills…" }), { target: { value: "zzz" } });
    expect(screen.getByText("No skills match “zzz”.")).toBeInTheDocument();
  });

  it("a card click opens the side preview with the body", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "pr-quality-rubric" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("heading", { name: "Rubric body" })).toBeInTheDocument();
  });

  it("the card toggle saves enabled without opening the preview", () => {
    renderView();
    fireEvent.click(screen.getByRole("switch", { name: /Enable pr-quality-rubric/ }));
    expect(update).toHaveBeenCalledWith({ id: "s2", patch: { enabled: false } }, expect.anything());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a failed toggle shows an error toast", async () => {
    update.mockImplementation((_input, opts: { onError?: (e: unknown) => void }) => opts.onError?.(new Error("boom")));
    renderView();
    fireEvent.click(screen.getByRole("switch", { name: /Enable pr-quality-rubric/ }));
    expect(await screen.findByText("Could not switch “pr-quality-rubric”: boom")).toBeInTheDocument();
  });

  it("Add → Create skill opens the editor", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Add Skill/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(within(screen.getByRole("dialog")).getByText("Create skill")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
  });

  it("Add → Import from file opens the import modal", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Add Skill/ }));
    fireEvent.click(screen.getByRole("button", { name: "Import from file" }));
    expect(within(screen.getByRole("dialog")).getByText("Import skill")).toBeInTheDocument();
    expect(screen.getByLabelText("Skill file")).toBeInTheDocument();
  });

  it("shows the empty state when the workspace has no skills", () => {
    list = [];
    renderView();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
  });
});
