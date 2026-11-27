import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { ApiError } from "@/lib/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const update = vi.fn();
const del = vi.fn();
vi.mock("@/lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
  useDeleteSkill: () => ({ mutate: del, isPending: false }),
}));

import { ConfigTab } from "./ConfigTab";
import { changedFields, formValues } from "./helpers";

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

beforeEach(() => {
  update.mockReset();
  del.mockReset();
  push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderTab(skill: Skill = SKILL) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <ToastProvider>
        <ConfigTab skill={skill} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

const save = () => screen.getByRole("button", { name: "Save skill" });

describe("ConfigTab", () => {
  it("starts from the saved skill; Save and Cancel wait for a change", () => {
    renderTab();
    expect(screen.getByRole("heading", { name: "Configuration" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("secret-leakage-gate");
    expect(screen.getByRole("textbox", { name: "Skill body" })).toHaveValue("- rules");
    expect(save()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByText("Only a change of the body creates a new version.")).toBeInTheDocument();
  });

  it("a body edit is marked unsaved, announces the next version and sends only the body", () => {
    update.mockImplementation((_input, opts: { onSuccess: (s: Skill) => void }) =>
      opts.onSuccess({ ...SKILL, body: "- new rules", version: 2 }),
    );
    renderTab();
    fireEvent.change(screen.getByRole("textbox", { name: "Skill body" }), { target: { value: "- new rules" } });
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByText("Saving snapshots the body as v2")).toBeInTheDocument();
    fireEvent.click(save());
    expect(update).toHaveBeenCalledWith({ id: "s1", patch: { body: "- new rules" } }, expect.anything());
    expect(screen.getByText("Skill saved (v2)")).toBeInTheDocument();
  });

  it("Cancel brings the saved values back", () => {
    renderTab();
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Other." } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Flag secrets.");
    expect(save()).toBeDisabled();
  });

  it("shows a taken name inline (409)", () => {
    update.mockImplementation((_input, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new ApiError("taken", 409, "skill_name_taken")),
    );
    renderTab();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "taken-name" } });
    fireEvent.click(save());
    expect(screen.getByRole("alert")).toHaveTextContent("A skill with this name already exists.");
  });

  it("does not send an invalid form", () => {
    renderTab();
    fireEvent.change(screen.getByRole("textbox", { name: "Skill body" }), { target: { value: "   " } });
    fireEvent.click(save());
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Body is required.");
  });

  it("the Enabled switch saves at once and is not part of Save", () => {
    renderTab();
    fireEvent.click(screen.getByRole("switch", { name: "Enabled" }));
    expect(update).toHaveBeenCalledWith({ id: "s1", patch: { enabled: false } }, expect.anything());
    expect(save()).toBeDisabled();
  });

  it("Delete asks first; on yes it deletes and goes back to the list", () => {
    del.mockImplementation((_id, opts: { onSuccess: () => void }) => opts.onSuccess());
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith("s1", expect.anything());
    expect(push).toHaveBeenCalledWith("/skills");
  });
});

describe("ConfigTab helpers", () => {
  it("sends only changed fields, the description trimmed, never `enabled`", () => {
    const v = { ...formValues(SKILL), description: "  Flag secrets.  ", enabled: false };
    expect(changedFields(SKILL, v)).toEqual({});
    expect(changedFields(SKILL, { ...v, type: "custom", body: "x" })).toEqual({ type: "custom", body: "x" });
  });
});
