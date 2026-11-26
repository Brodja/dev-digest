import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../../../../../../../messages/en/skills.json";
import { PreviewTab } from "./PreviewTab";
import { promptBlock } from "./helpers";

afterEach(cleanup);

const SKILL: Skill = {
  id: "s1",
  name: "pr-quality-rubric",
  description: "Score PR quality.",
  type: "rubric",
  source: "manual",
  body: "## Checks\n\n- tests added",
  enabled: true,
  version: 1,
  evidence_files: null,
  trusted: true,
};

const renderTab = (skill: Skill) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <PreviewTab skill={skill} />
    </NextIntlClientProvider>,
  );

describe("PreviewTab", () => {
  it("renders the block the reviewer reads: name, description, then the body as markdown", () => {
    renderTab(SKILL);
    const preview = within(screen.getByTestId("skill-preview"));
    expect(preview.getByRole("heading", { name: "pr-quality-rubric" })).toBeInTheDocument();
    expect(preview.getByText("Score PR quality.")).toBeInTheDocument();
    expect(preview.getByRole("heading", { name: "Checks" })).toBeInTheDocument();
    expect(preview.getByRole("listitem")).toHaveTextContent("tests added");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("explains how an untrusted skill reaches the prompt, and renders it as text", () => {
    renderTab({ ...SKILL, trusted: false, source: "imported_file", body: '<img src=x onerror="alert(1)">' });
    expect(screen.getByRole("note")).toHaveTextContent(/untrusted data/);
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("promptBlock", () => {
  it("matches reviewer-core renderSkillBlock (minus the untrusted wrapper)", () => {
    expect(promptBlock({ name: "a", description: " Do X. ", body: "\n- r\n" })).toBe("### a\nDo X.\n\n- r");
    expect(promptBlock({ name: "a", description: "  ", body: "- r" })).toBe("### a\n\n- r");
  });
});
