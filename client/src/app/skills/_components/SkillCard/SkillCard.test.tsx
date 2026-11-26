import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "s1",
  name: "secret-leakage-gate",
  description: "Flag any hard-coded secret added in the diff.",
  type: "security",
  source: "manual",
  body: "- rules",
  enabled: true,
  version: 2,
  evidence_files: null,
  trusted: true,
};

function renderCard(skill: Skill, onOpen = vi.fn(), onToggle = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <SkillCard skill={skill} onOpen={onOpen} onToggle={onToggle} />
    </NextIntlClientProvider>,
  );
  return { onOpen, onToggle };
}

describe("SkillCard", () => {
  it("shows name, type, description and source", () => {
    renderCard(SKILL);
    expect(screen.getByRole("button", { name: "secret-leakage-gate" })).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("Flag any hard-coded secret added in the diff.")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.queryByText("untrusted")).not.toBeInTheDocument();
  });

  it("the toggle saves enabled and does not open the skill", () => {
    const { onOpen, onToggle } = renderCard(SKILL);
    fireEvent.click(screen.getByRole("switch", { name: /Enable secret-leakage-gate/ }));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("a click on the card or its name opens the skill", () => {
    const { onOpen } = renderCard(SKILL);
    fireEvent.click(screen.getByText("Flag any hard-coded secret added in the diff."));
    fireEvent.click(screen.getByRole("button", { name: "secret-leakage-gate" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("marks an imported skill as untrusted and a disabled one as disabled", () => {
    renderCard({ ...SKILL, source: "imported_file", trusted: false, enabled: false });
    expect(screen.getByText("untrusted")).toBeInTheDocument();
    expect(screen.getByText("Imported (file)")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
