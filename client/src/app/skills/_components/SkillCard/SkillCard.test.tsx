import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillListItem } from "@devdigest/shared";
import skills from "../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SKILL: SkillListItem = {
  id: "s1",
  name: "secret-leakage-gate",
  description: "Flag any hard-coded secret added in the diff.",
  type: "security",
  source: "manual",
  body: "- rules",
  enabled: true,
  version: 3,
  evidence_files: null,
  trusted: true,
  used_by_count: 2,
  pull_rate: 0.254,
  accept_rate: 0.75,
};

function renderCard(skill: SkillListItem, props: { deleting?: boolean } = {}) {
  const onOpen = vi.fn();
  const onToggle = vi.fn();
  const onDelete = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <SkillCard skill={skill} onOpen={onOpen} onToggle={onToggle} onDelete={onDelete} {...props} />
    </NextIntlClientProvider>,
  );
  return { onOpen, onToggle, onDelete };
}

const trash = () => screen.getByRole("button", { name: "Delete skill secret-leakage-gate" });

describe("SkillCard", () => {
  it("shows name, type, description, and the source with the version", () => {
    renderCard(SKILL);
    expect(screen.getByRole("button", { name: "secret-leakage-gate" })).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("Flag any hard-coded secret added in the diff.")).toBeInTheDocument();
    expect(screen.getByText("Manual · v3")).toBeInTheDocument();
    expect(screen.queryByText("untrusted")).not.toBeInTheDocument();
  });

  it("shows the usage row: agents, pull frequency and accept rate (green from 60%)", () => {
    renderCard(SKILL);
    const usage = within(screen.getByTestId("skill-usage"));
    expect(usage.getByText("2 agents")).toBeInTheDocument();
    expect(usage.getByText("25% pull freq")).toBeInTheDocument();
    expect(usage.getByText("75% accept")).toHaveStyle({ color: "var(--ok)" });
    cleanup();
    renderCard({ ...SKILL, used_by_count: 1, accept_rate: 0.4 });
    expect(screen.getByText("1 agent")).toBeInTheDocument();
    expect(screen.getByText("40% accept")).toHaveStyle({ color: "var(--warn)" });
  });

  it("shows a dash, not 0%, when there are no runs or no decided findings", () => {
    renderCard({ ...SKILL, used_by_count: 0, pull_rate: null, accept_rate: null });
    const usage = within(screen.getByTestId("skill-usage"));
    expect(usage.getByText("0 agents")).toBeInTheDocument();
    expect(usage.getByText("— pull freq")).toBeInTheDocument();
    expect(usage.getByText("— accept")).toBeInTheDocument();
  });

  it("the toggle saves enabled and does not open the skill", () => {
    const { onOpen, onToggle } = renderCard(SKILL);
    fireEvent.click(screen.getByRole("switch", { name: /Enable secret-leakage-gate/ }));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("the trash asks first, deletes only on yes, and never opens the skill", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { onOpen, onDelete } = renderCard(SKILL);
    fireEvent.click(trash());
    expect(confirm).toHaveBeenLastCalledWith('Delete skill "secret-leakage-gate"? This cannot be undone.');
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(trash());
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("the trash is disabled while the delete runs", () => {
    renderCard(SKILL, { deleting: true });
    expect(trash()).toBeDisabled();
  });

  it("a click on the card or its name opens the skill", () => {
    const { onOpen } = renderCard(SKILL);
    fireEvent.click(screen.getByText("Flag any hard-coded secret added in the diff."));
    fireEvent.click(screen.getByRole("button", { name: "secret-leakage-gate" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("marks an imported skill as untrusted and a disabled one as disabled", () => {
    renderCard({ ...SKILL, source: "imported_file", trusted: false, enabled: false, version: 1 });
    expect(screen.getByText("untrusted")).toBeInTheDocument();
    expect(screen.getByText("Imported (file) · v1")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
