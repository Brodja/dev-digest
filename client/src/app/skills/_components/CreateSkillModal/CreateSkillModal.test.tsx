import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { ApiError } from "@/lib/api";

const create = vi.fn();
vi.mock("@/lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutate: create, isPending: false }),
}));

import { CreateSkillModal } from "./CreateSkillModal";

beforeEach(() => {
  create.mockReset();
});
afterEach(cleanup);

const CREATED: Skill = {
  id: "s9",
  name: "secret-leakage-gate",
  description: "Flag any hard-coded secret.",
  type: "security",
  source: "manual",
  body: "- sk_live_ keys are CRITICAL",
  enabled: true,
  version: 1,
  evidence_files: null,
  trusted: true,
};

function renderModal() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <ToastProvider>
        <CreateSkillModal onClose={onClose} onCreated={onCreated} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onClose, onCreated };
}

const type = (name: string, value: string) =>
  fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });

describe("CreateSkillModal", () => {
  it("creates a skill with the typed fields, then hands it over to open its page", () => {
    create.mockImplementation((_input, opts: { onSuccess: (s: Skill) => void }) => opts.onSuccess(CREATED));
    const { onClose, onCreated } = renderModal();
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
    expect(onClose).toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(CREATED);
  });

  it("does not send an invalid form and shows what is missing", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")).toHaveLength(3);
  });

  it("shows a 409 next to the name and stays open", () => {
    create.mockImplementation((_input, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new ApiError('A skill named "x" already exists', 409, "skill_name_taken")),
    );
    const { onClose, onCreated } = renderModal();
    type("Name", "taken-name");
    type("Description", "Do X.");
    type("Skill body", "rules");
    fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
    expect(screen.getByRole("alert")).toHaveTextContent("A skill with this name already exists.");
    expect(onClose).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("Cancel sends nothing", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(create).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
