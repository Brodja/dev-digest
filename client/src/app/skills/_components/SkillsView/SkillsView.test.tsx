import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import skills from "../../../../../messages/en/skills.json";

const shell = vi.fn();
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children, crumb }: { children: React.ReactNode; crumb?: { label: string }[] }) => {
    shell(crumb);
    return <div>{children}</div>;
  },
}));
vi.mock("../SkillsSidebar", () => ({
  SkillsSidebar: ({ activeId, tab }: { activeId?: string; tab?: string }) => (
    <aside data-testid="sidebar" data-active={activeId ?? ""} data-tab={tab ?? ""} />
  ),
}));

import { SkillsView } from "./SkillsView";

afterEach(() => {
  cleanup();
  shell.mockReset();
});

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      {ui}
    </NextIntlClientProvider>,
  );

describe("SkillsView (Skills Lab frame)", () => {
  it("/skills: the list and a pick-a-skill placeholder, under Skills Lab › Skills", () => {
    wrap(<SkillsView />);
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-active", "");
    expect(screen.getByText("Pick a skill")).toBeInTheDocument();
    expect(shell).toHaveBeenCalledWith([{ label: "Skills Lab" }, { label: "Skills" }]);
  });

  it("/skills/:id: the list marks the skill and the page content replaces the placeholder", () => {
    wrap(
      <SkillsView activeId="s2" tab="stats" crumb={[{ label: "X" }]}>
        <p>editor</p>
      </SkillsView>,
    );
    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveAttribute("data-active", "s2");
    expect(sidebar).toHaveAttribute("data-tab", "stats");
    expect(screen.getByText("editor")).toBeInTheDocument();
    expect(screen.queryByText("Pick a skill")).not.toBeInTheDocument();
    expect(shell).toHaveBeenCalledWith([{ label: "X" }]);
  });
});
