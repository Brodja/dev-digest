import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillDetail } from "@devdigest/shared";
import skills from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const del = vi.fn();
let detail: SkillDetail;
vi.mock("@/lib/hooks/skills", () => ({
  useSkill: () => ({ data: detail, isLoading: false, isError: false, refetch: vi.fn() }),
  useDeleteSkill: () => ({ mutate: del, isPending: false }),
}));

import { SkillPreviewDrawer } from "./SkillPreviewDrawer";

const BASE: SkillDetail = {
  id: "s1",
  name: "secret-leakage-gate",
  description: "Flag any hard-coded secret added in the diff.",
  type: "security",
  source: "manual",
  body: "## Rules\n\n- Treat `sk_live_` keys as **CRITICAL**.",
  enabled: true,
  version: 3,
  evidence_files: null,
  trusted: true,
  used_by: [{ id: "a1", name: "General Reviewer" }],
};

beforeEach(() => {
  detail = BASE;
  del.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderDrawer(onEdit = vi.fn(), onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <ToastProvider>
        <SkillPreviewDrawer skillId="s1" onClose={onClose} onEdit={onEdit} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onEdit, onClose };
}

describe("SkillPreviewDrawer", () => {
  it("shows metadata, the description, the body as markdown and who uses it", () => {
    renderDrawer();
    expect(screen.getByRole("dialog")).toHaveTextContent("secret-leakage-gate");
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Flag any hard-coded secret added in the diff.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument();
    expect(screen.getByText("CRITICAL").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: /General Reviewer/ })).toHaveAttribute("href", "/agents/a1?tab=skills");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("explains that an imported skill is untrusted", () => {
    detail = { ...BASE, source: "imported_file", trusted: false, used_by: [] };
    renderDrawer();
    expect(screen.getByRole("note")).toHaveTextContent(/only as untrusted data/);
    expect(screen.getByText("Not linked to any agent yet.")).toBeInTheDocument();
  });

  it("Edit hands the skill to the editor", () => {
    const { onEdit } = renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(BASE);
  });

  it("Delete asks first and deletes only on confirm", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining("removed from all agents"));
    expect(del).toHaveBeenCalledWith("s1", expect.anything());
  });

  it("a failed delete shows an error toast and keeps the drawer open", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    del.mockImplementation((_id, opts: { onError?: (e: unknown) => void }) => opts.onError?.(new Error("network down")));
    const { onClose } = renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Could not delete “secret-leakage-gate”: network down")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
