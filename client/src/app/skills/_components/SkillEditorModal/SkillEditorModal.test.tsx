import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { ApiError } from "@/lib/api";

const create = vi.fn();
const update = vi.fn();
vi.mock("@/lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutate: create, isPending: false }),
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
}));

import { SkillEditorModal } from "./SkillEditorModal";

beforeEach(() => {
  create.mockReset();
  update.mockReset();
});
afterEach(cleanup);

const SKILL: Skill = {
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
};

function renderModal(skill?: Skill, onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <ToastProvider>
        <SkillEditorModal skill={skill} onClose={onClose} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onClose };
}

const type = (name: string, value: string) =>
  fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });

describe("SkillEditorModal", () => {
  it("creates a skill with the typed fields", () => {
    renderModal();
    expect(screen.getByText("Create skill")).toBeInTheDocument();
    type("Name", "secret-leakage-gate");
    type("Description", "  Flag any hard-coded secret.  ");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "security" } });
    type("Skill body", "- sk_live_ keys are CRITICAL");
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0]).toEqual({
      name: "secret-leakage-gate",
      description: "Flag any hard-coded secret.",
      type: "security",
      body: "- sk_live_ keys are CRITICAL",
      enabled: true,
    });
  });

  it("does not send an invalid form and shows what is missing", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")).toHaveLength(3);
  });

  it("shows a 409 next to the name", () => {
    create.mockImplementation((_input, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new ApiError('A skill named "x" already exists', 409, "skill_name_taken")),
    );
    renderModal();
    type("Name", "taken-name");
    type("Description", "Do X.");
    type("Skill body", "rules");
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(screen.getByRole("alert")).toHaveTextContent("A skill with this name already exists.");
  });

  it("edits: sends only the changed fields", () => {
    renderModal(SKILL);
    expect(screen.getByText("Edit skill")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("secret-leakage-gate");
    type("Description", "Flag any committed secret.");
    fireEvent.click(screen.getByRole("switch", { name: "Enabled" }));
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0]).toEqual({
      id: "s1",
      patch: { description: "Flag any committed secret.", enabled: false },
    });
  });

  it("edits with no change just closes", () => {
    const { onClose } = renderModal(SKILL);
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(update).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
