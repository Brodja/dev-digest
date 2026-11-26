import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import skills from "../../../../../messages/en/skills.json";
import { SkillForm } from "./SkillForm";
import { EMPTY_SKILL, estimateTokens, validateSkill, type SkillFormValues } from "./helpers";

afterEach(cleanup);

/** Controlled host, like the modal. */
function Host({ initial = EMPTY_SKILL, ...props }: { initial?: SkillFormValues; showRequired?: boolean; nameTaken?: boolean }) {
  const [values, setValues] = React.useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <SkillForm values={values} onChange={(p) => setValues((v) => ({ ...v, ...p }))} {...props} />
    </NextIntlClientProvider>
  );
}

describe("SkillForm", () => {
  it("puts the directive hint next to the description field", () => {
    render(<Host />);
    const description = screen.getByRole("textbox", { name: "Description" });
    const field = description.closest("div[style]")!.parentElement!;
    expect(field).toHaveTextContent(/Write it as a directive — what the reviewer must do/);
    expect(field).toHaveTextContent(/sent to the model as the first line of the skill/);
  });

  it("shows a token estimate that follows the body", () => {
    render(<Host />);
    expect(screen.getByText(/≈ 0 tokens/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Skill body" }), { target: { value: "x".repeat(41) } });
    expect(screen.getByText(/≈ 11 tokens/)).toBeInTheDocument();
  });

  it("shows a bad slug at once, required errors only after a save attempt", () => {
    const { rerender } = render(<Host />);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Bad Name" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/kebab-case slug/);

    // Same host → the typed (bad) name stays; the empty fields now say "required".
    rerender(<Host showRequired />);
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(alerts).toHaveLength(3);
    expect(alerts[0]).toMatch(/kebab-case slug/);
    expect(alerts.slice(1)).toEqual(["Description is required.", "Body is required."]);
  });

  it("an empty name is reported as required after a save attempt", () => {
    render(<Host showRequired />);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Name is required.");
  });

  it("shows a server-side taken name", () => {
    render(<Host initial={{ ...EMPTY_SKILL, name: "taken" }} nameTaken />);
    expect(screen.getByRole("alert")).toHaveTextContent("A skill with this name already exists.");
  });

  it("the enabled toggle does not submit a surrounding form", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Host />
      </form>,
    );
    const sw = screen.getByRole("switch", { name: "Enabled" });
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("validateSkill", () => {
  const ok: SkillFormValues = { name: "a-b", description: "Do X.", type: "custom", body: "rules", enabled: true };

  it("accepts a valid skill", () => {
    expect(validateSkill(ok)).toEqual({});
  });

  it("mirrors the server limits", () => {
    expect(validateSkill({ ...ok, name: "-x" }).name?.key).toBe("nameFormat");
    expect(validateSkill({ ...ok, description: "   " }).description?.key).toBe("descriptionRequired");
    expect(validateSkill({ ...ok, description: "x".repeat(1025) }).description?.key).toBe("descriptionTooLong");
    expect(validateSkill({ ...ok, body: " \n " }).body?.key).toBe("bodyRequired");
    expect(validateSkill({ ...ok, body: "x".repeat(40_001) }).body?.key).toBe("bodyTooLong");
  });

  it("estimates tokens as chars / 4, rounded up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
