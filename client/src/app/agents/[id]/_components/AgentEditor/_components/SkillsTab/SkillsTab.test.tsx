import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AgentSkillLink, Skill } from "@devdigest/shared";
import agents from "../../../../../../../../messages/en/agents.json";
import { ToastProvider } from "@/lib/toast";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const setLinks = vi.fn();
let links: AgentSkillLink[] = [];
let skills: Skill[] = [];
vi.mock("@/lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: links, isLoading: false, isError: false, refetch: vi.fn() }),
  useSetAgentSkills: () => ({ mutate: setLinks, isPending: false }),
}));
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: skills, isLoading: false, isError: false, refetch: vi.fn() }),
}));

import { SkillsTab } from "./SkillsTab";

const skill = (id: string, over: Partial<Skill> = {}): Skill => ({
  id,
  name: `skill-${id}`,
  description: "d",
  type: "custom",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
  evidence_files: null,
  trusted: true,
  ...over,
});
const link = (skill_id: string, order: number, enabled = true): AgentSkillLink => ({
  agent_id: "ag1",
  skill_id,
  order,
  enabled,
});

beforeEach(() => {
  skills = [
    skill("a", { type: "security", description: "secrets" }),
    skill("b", { source: "imported_file", trusted: false }),
    skill("c", { enabled: false }),
    skill("d"),
  ];
  // prompt order: c, a — b's link is switched off (legacy), d is not linked
  links = [link("a", 1), link("b", 2, false), link("c", 0)];
  setLinks.mockReset();
});
afterEach(cleanup);

function renderTab() {
  render(
    <NextIntlClientProvider locale="en" messages={{ agents }}>
      <ToastProvider>
        <SkillsTab agentId="ag1" />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

const rowNames = () =>
  within(screen.getByRole("list", { name: "Skills" }))
    .getAllByRole("listitem")
    .map((li) => li.getAttribute("data-testid"));

const box = (name: string) => screen.getByRole("checkbox", { name });
const sent = () => setLinks.mock.calls.at(-1)![0];
const sentIds = () => sent().links.map((l: { skill_id: string }) => l.skill_id);

describe("Agent editor → Skills tab", () => {
  it("lists every skill: the linked ones in prompt order, then the rest by name", () => {
    renderTab();
    expect(rowNames()).toEqual(["skill-row-skill-c", "skill-row-skill-a", "skill-row-skill-b", "skill-row-skill-d"]);
    expect(box("skill-c")).toHaveAttribute("aria-checked", "true");
    expect(box("skill-a")).toHaveAttribute("aria-checked", "true");
    // A link switched off never reaches the prompt: shown unchecked.
    expect(box("skill-b")).toHaveAttribute("aria-checked", "false");
    expect(box("skill-d")).toHaveAttribute("aria-checked", "false");
  });

  it("heads the list with what reaches the prompt out of all skills, the filter and the order hint", () => {
    renderTab();
    // a is linked and on; c is linked but off on the Skills page.
    expect(screen.getByText("1 of 4 enabled")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Filter skills…" })).toBeInTheDocument();
    expect(screen.getByText(/Order matters .* Drag to reorder\./)).toBeInTheDocument();
    expect(within(screen.getByTestId("skill-row-skill-b")).getByText("untrusted")).toBeInTheDocument();
    expect(within(screen.getByTestId("skill-row-skill-c")).getByText(/off on the Skills page/)).toBeInTheDocument();
    expect(within(screen.getByTestId("skill-row-skill-a")).getByText("security")).toBeInTheDocument();
  });

  it("checking a skill links it at the end of the prompt order, enabled", () => {
    renderTab();
    fireEvent.click(box("skill-d"));
    expect(sent()).toEqual({
      agentId: "ag1",
      links: [
        { skill_id: "c", enabled: true },
        { skill_id: "a", enabled: true },
        { skill_id: "d", enabled: true },
      ],
    });
  });

  it("unchecking a skill unlinks it", () => {
    renderTab();
    fireEvent.click(box("skill-a"));
    expect(sentIds()).toEqual(["c"]);
  });

  it("drag and drop moves a linked row", () => {
    renderTab();
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    const from = screen.getByTestId("skill-row-skill-a");
    const to = screen.getByTestId("skill-row-skill-c");
    fireEvent.dragStart(from, { dataTransfer });
    fireEvent.dragOver(to, { dataTransfer });
    fireEvent.drop(to, { dataTransfer });
    expect(sentIds()).toEqual(["a", "c"]);
  });

  it("the arrow keys on a focused grip move the row; the ends stay put", () => {
    renderTab();
    const gripC = screen.getByRole("button", { name: /Reorder skill-c/ });
    fireEvent.keyDown(gripC, { key: "ArrowUp" });
    expect(setLinks).not.toHaveBeenCalled();
    fireEvent.keyDown(gripC, { key: "ArrowDown" });
    expect(sentIds()).toEqual(["a", "c"]);
    // Unlinked rows have no reorder control.
    expect(screen.queryByRole("button", { name: /Reorder skill-d/ })).toBeNull();
  });

  it("the filter narrows the list and turns reordering off", () => {
    renderTab();
    fireEvent.change(screen.getByRole("textbox", { name: "Filter skills…" }), { target: { value: "secret" } });
    expect(rowNames()).toEqual(["skill-row-skill-a"]);
    expect(screen.getByRole("button", { name: /Reorder skill-a/ })).toBeDisabled();
    expect(screen.getByTestId("skill-row-skill-a")).not.toHaveAttribute("draggable");
    fireEvent.change(screen.getByRole("textbox", { name: "Filter skills…" }), { target: { value: "zzz" } });
    expect(screen.getByText("No skills match “zzz”.")).toBeInTheDocument();
  });

  it("says the change was undone when the server refuses it", async () => {
    setLinks.mockImplementation((_input, opts: { onError?: (e: unknown) => void }) =>
      opts.onError?.(new ApiError("Unknown skill for this workspace", 422, "validation_error")),
    );
    renderTab();
    fireEvent.click(box("skill-d"));
    expect(
      await screen.findByText("Could not save the skill links — your change was undone. Unknown skill for this workspace"),
    ).toBeInTheDocument();
  });

  it("points to the Skills page when the workspace has no skills", () => {
    skills = [];
    links = [];
    renderTab();
    expect(screen.getByText("No skills in this workspace yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a skill" })).toBeInTheDocument();
  });
});
