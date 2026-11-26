import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillStats } from "@devdigest/shared";
import skills from "../../../../../../../../messages/en/skills.json";

let stats: SkillStats | undefined;
vi.mock("@/lib/hooks/skills", () => ({
  useSkillStats: () => ({ data: stats, isLoading: false, isError: !stats, refetch: vi.fn() }),
}));

import { StatsTab } from "./StatsTab";

afterEach(cleanup);

const renderTab = () =>
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <StatsTab skillId="s1" />
    </NextIntlClientProvider>,
  );

describe("StatsTab", () => {
  it("counts the agents and shows each one's place and state, with a link to its Skills tab", () => {
    stats = {
      skill_id: "s1",
      version: 2,
      version_count: 2,
      used_by_count: 2,
      in_prompt_count: 1,
      agents: [
        { agent_id: "a1", agent_name: "Alpha", agent_enabled: true, link_enabled: true, position: 2, in_prompt: true },
        { agent_id: "a2", agent_name: "Beta", agent_enabled: false, link_enabled: false, position: 1, in_prompt: false },
      ],
    };
    renderTab();
    expect(screen.getByText("Used by").parentElement).toHaveTextContent("2 agents");
    expect(screen.getByText("In prompt").parentElement).toHaveTextContent("1 agent");
    expect(screen.getByText("Versions").parentElement).toHaveTextContent("2");

    const alpha = within(screen.getByTestId("usage-a1"));
    expect(alpha.getByText("#2")).toBeInTheDocument();
    expect(alpha.getByText("in prompt")).toBeInTheDocument();
    expect(alpha.getByRole("link", { name: "Open the Skills tab of Alpha" })).toHaveAttribute(
      "href",
      "/agents/a1?tab=skills",
    );
    const beta = within(screen.getByTestId("usage-a2"));
    expect(beta.getByText("link off")).toBeInTheDocument();
    expect(beta.getByText("agent disabled")).toBeInTheDocument();
  });

  it("says why a linked skill is not in the prompt when the skill itself is off", () => {
    stats = {
      skill_id: "s1",
      version: 1,
      version_count: 1,
      used_by_count: 1,
      in_prompt_count: 0,
      agents: [{ agent_id: "a1", agent_name: "Alpha", agent_enabled: true, link_enabled: true, position: 1, in_prompt: false }],
    };
    renderTab();
    expect(within(screen.getByTestId("usage-a1")).getByText("skill disabled")).toBeInTheDocument();
  });

  it("an unused skill gets the empty state", () => {
    stats = { skill_id: "s1", version: 1, version_count: 1, used_by_count: 0, in_prompt_count: 0, agents: [] };
    renderTab();
    expect(screen.getByText("No agent uses this skill yet")).toBeInTheDocument();
  });

  it("a failed load offers a retry", () => {
    stats = undefined;
    renderTab();
    expect(screen.getByText("Could not load the usage of this skill.")).toBeInTheDocument();
  });
});
