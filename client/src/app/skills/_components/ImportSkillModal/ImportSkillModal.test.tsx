import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillImportPreview } from "@devdigest/shared";
import skills from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { ApiError } from "@/lib/api";

const previewMutate = vi.fn();
const importMutate = vi.fn();
vi.mock("@/lib/hooks/skills", () => ({
  useImportSkillPreview: () => ({ mutate: previewMutate, isPending: false }),
  useImportSkill: () => ({ mutate: importMutate, isPending: false }),
}));

import { ImportSkillModal } from "./ImportSkillModal";

const PREVIEW: SkillImportPreview = {
  draft: {
    name: "owasp-top10",
    description: "Check every changed endpoint against the OWASP Top 10.",
    type: "security",
    body: "# OWASP\n\n- A01 Broken access control",
  },
  origin: { filename: "owasp.zip", kind: "archive", skill_path: "owasp/SKILL.md" },
  ignored: [
    { path: "owasp/scripts/check.py", reason: "script" },
    { path: "owasp/references/api.md", reason: "other" },
  ],
  warnings: ["The body refers to files that are not imported: scripts/check.py."],
  name_taken: false,
};

type Opts = { onSuccess?: (v: unknown) => void; onError?: (e: unknown) => void; onSettled?: () => void };

beforeEach(() => {
  previewMutate.mockReset();
  importMutate.mockReset();
});
afterEach(cleanup);

function renderModal(onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <ToastProvider>
        <ImportSkillModal onClose={onClose} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onClose };
}

const pick = (file: File) => fireEvent.change(screen.getByLabelText("Skill file"), { target: { files: [file] } });

/** Pick a file and answer the preview call with `result`. */
async function pickAndPreview(result: SkillImportPreview = PREVIEW) {
  previewMutate.mockImplementation((_input, opts: Opts) => {
    opts.onSuccess?.(result);
    opts.onSettled?.();
  });
  pick(new File(["---\nname: owasp-top10\n---\nbody"], "owasp.zip"));
  await screen.findByRole("note");
}

describe("ImportSkillModal", () => {
  it("sends the picked file as base64 for a preview", async () => {
    renderModal();
    pick(new File(["# Rules\n- one"], "SKILL.md", { type: "text/markdown" }));
    await waitFor(() => expect(previewMutate).toHaveBeenCalled());
    expect(previewMutate.mock.calls[0]![0]).toEqual({
      filename: "SKILL.md",
      content_base64: btoa("# Rules\n- one"),
    });
  });

  it("refuses a file over 1 MB in the browser, without calling the server", () => {
    renderModal();
    pick(new File([new Uint8Array(1_048_577)], "big.zip"));
    expect(screen.getByRole("alert")).toHaveTextContent(/Too large/);
    expect(previewMutate).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the upload is refused", async () => {
    previewMutate.mockImplementation((_input, opts: Opts) => {
      opts.onError?.(new ApiError("The archive has no SKILL.md", 422, "import_invalid", { reason: "no_skill_md" }));
      opts.onSettled?.();
    });
    renderModal();
    pick(new File(["x"], "a.zip"));
    expect(await screen.findByRole("alert")).toHaveTextContent("The archive has no SKILL.md.");
  });

  it("previews the draft: origin, untrusted notice, warnings, ignored files, rendered body, editable form", async () => {
    renderModal();
    await pickAndPreview();
    expect(screen.getByText("owasp.zip")).toBeInTheDocument();
    expect(screen.getByText("owasp/SKILL.md")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/untrusted/);
    expect(screen.getByText(PREVIEW.warnings[0]!)).toBeInTheDocument();
    const ignored = screen.getByRole("list", { name: /2 files ignored/ });
    expect(within(ignored).getByText("owasp/scripts/check.py")).toBeInTheDocument();
    expect(within(ignored).getByText("script")).toBeInTheDocument();
    expect(within(ignored).getByText("not used")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OWASP" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("owasp-top10");
    // Imported skills are always saved disabled: no switch is offered.
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("stores only on Import skill, with the edited fields", async () => {
    importMutate.mockImplementation((_input, opts: Opts) => opts.onSuccess?.({ name: "owasp-strict" }));
    const { onClose } = renderModal();
    await pickAndPreview();
    expect(importMutate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "owasp-strict" } });
    fireEvent.click(screen.getByRole("button", { name: "Import skill" }));
    expect(importMutate.mock.calls[0]![0]).toEqual({
      name: "owasp-strict",
      description: PREVIEW.draft.description,
      type: "security",
      body: PREVIEW.draft.body,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("Cancel after the preview stores nothing", async () => {
    const { onClose } = renderModal();
    await pickAndPreview();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(importMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("flags a name the workspace already has", async () => {
    renderModal();
    await pickAndPreview({ ...PREVIEW, name_taken: true });
    expect(screen.getByRole("alert")).toHaveTextContent("A skill with this name already exists.");
  });
});
