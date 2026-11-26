import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AgentSkillLink, Skill } from "@devdigest/shared";
import agents from "../../../../../../../../messages/en/agents.json";

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
    skill("a", { type: "security" }),
    skill("b", { source: "imported_file", trusted: false }),
    skill("c", { enabled: false }),
    skill("d"),
  ];
  // prompt order: c, a, b — d is not linked
  links = [link("a", 1), link("b", 2, false), link("c", 0)];
  setLinks.mockReset();
});
afterEach(cleanup);

function renderTab() {
  render(
    <NextIntlClientProvider locale="en" messages={{ agents }}>
      <SkillsTab agentId="ag1" />
    </NextIntlClientProvider>,
  );
}

const rowNames = () =>
  within(screen.getByRole("list", { name: "Skills" }))
    .getAllByRole("listitem")
    .map((li) => li.getAttribute("data-testid"));

const sent = () => setLinks.mock.calls.at(-1)![0];

describe("Agent editor → Skills tab", () => {
  it("lists the linked skills in prompt order with their state", () => {
    renderTab();
    expect(rowNames()).toEqual(["skill-row-skill-c", "skill-row-skill-a", "skill-row-skill-b"]);
    // c: link on but skill off on the Skills page; b: link off → only a is sent.
    expect(screen.getByText("1 of 3 enabled")).toBeInTheDocument();
    expect(screen.getByText(/Drag to reorder/)).toBeInTheDocument();
    const rowB = screen.getByTestId("skill-row-skill-b");
    expect(within(rowB).getByText("untrusted")).toBeInTheDocument();
    expect(within(rowB).getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(within(screen.getByTestId("skill-row-skill-c")).getByText(/off on the Skills page/)).toBeInTheDocument();
  });

  it("the per-agent toggle sends the full list with that link switched", () => {
    renderTab();
    fireEvent.click(screen.getByRole("switch", { name: "Send skill-b in this agent's prompt" }));
    expect(sent()).toEqual({
      agentId: "ag1",
      links: [
        { skill_id: "c", enabled: true },
        { skill_id: "a", enabled: true },
        { skill_id: "b", enabled: true },
      ],
    });
  });

  it("↑ / ↓ reorder; the first row has no ↑ and the last no ↓", () => {
    renderTab();
    expect(screen.queryByRole("button", { name: "Move skill-c up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move skill-b down" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Move skill-c down" }));
    expect(sent().links.map((l: { skill_id: string }) => l.skill_id)).toEqual(["a", "c", "b"]);
    fireEvent.click(screen.getByRole("button", { name: "Move skill-b up" }));
    expect(sent().links.map((l: { skill_id: string }) => l.skill_id)).toEqual(["c", "b", "a"]);
  });

  it("drag and drop moves a row", () => {
    renderTab();
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    const from = screen.getByTestId("skill-row-skill-b");
    const to = screen.getByTestId("skill-row-skill-c");
    fireEvent.dragStart(from, { dataTransfer });
    fireEvent.dragOver(to, { dataTransfer });
    fireEvent.drop(to, { dataTransfer });
    expect(sent().links).toEqual([
      { skill_id: "b", enabled: false },
      { skill_id: "c", enabled: true },
      { skill_id: "a", enabled: true },
    ]);
  });

  it("unlinks a skill", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Unlink skill-a" }));
    expect(sent().links.map((l: { skill_id: string }) => l.skill_id)).toEqual(["c", "b"]);
  });

  it("links an unlinked skill at the end, enabled", () => {
    renderTab();
    fireEvent.click(screen.getByText("Link a skill…"));
    fireEvent.click(screen.getByText("skill-d"));
    expect(sent().links.at(-1)).toEqual({ skill_id: "d", enabled: true });
    expect(sent().links).toHaveLength(4);
  });

  it("points to the Skills page when the workspace has no skills", () => {
    skills = [];
    links = [];
    renderTab();
    expect(screen.getByText("No skills in this workspace yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a skill" })).toBeInTheDocument();
  });
});
