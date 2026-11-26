import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillVersion } from "@devdigest/shared";
import skills from "../../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const restore = vi.fn();
let versions: SkillVersion[] = [];
vi.mock("@/lib/hooks/skills", () => ({
  useSkillVersions: () => ({ data: versions, isLoading: false, isError: false, refetch: vi.fn() }),
  useRestoreSkillVersion: () => ({ mutate: restore, isPending: false }),
}));

import { VersionsTab } from "./VersionsTab";
import { foldContext, lineDiff } from "./helpers";

const SKILL: Skill = {
  id: "s1",
  name: "secret-leakage-gate",
  description: "Flag secrets.",
  type: "security",
  source: "manual",
  body: "- one\n- three",
  enabled: true,
  version: 3,
  evidence_files: null,
  trusted: true,
};

const v = (version: number, body: string): SkillVersion => ({
  skill_id: "s1",
  version,
  body,
  created_at: new Date(Date.now() - version * 60_000).toISOString(),
});

beforeEach(() => {
  versions = [v(3, "- one\n- three"), v(2, "- one\n- two"), v(1, "- one\n- three")];
  restore.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderTab() {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <ToastProvider>
        <VersionsTab skill={SKILL} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("VersionsTab", () => {
  it("lists the versions newest first and marks the current one", () => {
    renderTab();
    expect(screen.getByRole("heading", { name: "Version history" })).toBeInTheDocument();
    expect(screen.getByText("3 versions")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Version history" })).getAllByRole("listitem");
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual(["version-3", "version-2", "version-1"]);
    expect(within(rows[0]!).getByText("Current")).toBeInTheDocument();
  });

  it("offers Restore only for a body other than the current one", () => {
    renderTab();
    expect(within(screen.getByTestId("version-3")).queryByRole("button", { name: /Restore/ })).toBeNull();
    expect(within(screen.getByTestId("version-2")).getByRole("button", { name: /Restore/ })).toBeInTheDocument();
    // v1 has the same body as now: restoring it would change nothing.
    expect(within(screen.getByTestId("version-1")).queryByRole("button", { name: /Restore/ })).toBeNull();
  });

  it("Diff shows the line changes against the version before", () => {
    renderTab();
    const row = within(screen.getByTestId("version-3"));
    fireEvent.click(row.getByRole("button", { name: /Diff/ }));
    const diff = row.getByRole("region", { name: "Changes from v2 to v3" });
    expect(diff).toHaveTextContent("- - two");
    expect(diff).toHaveTextContent("+ - three");
    fireEvent.click(row.getByRole("button", { name: /Hide diff/ }));
    expect(row.queryByRole("region")).toBeNull();
    // The oldest version has nothing to compare with.
    expect(within(screen.getByTestId("version-1")).queryByRole("button", { name: /Diff/ })).toBeNull();
  });

  it("Restore asks first, then restores and says which version it became", () => {
    restore.mockImplementation((_input, opts: { onSuccess: (s: Skill) => void }) =>
      opts.onSuccess({ ...SKILL, version: 4, body: "- one\n- two" }),
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderTab();
    const button = within(screen.getByTestId("version-2")).getByRole("button", { name: /Restore/ });
    fireEvent.click(button);
    expect(restore).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(confirm.mock.calls[1]![0]).toMatch(/Restore v2\? Its body becomes v4/);
    expect(restore).toHaveBeenCalledWith({ id: "s1", version: 2 }, expect.anything());
    expect(screen.getByText("Restored v2 as v4")).toBeInTheDocument();
  });
});

describe("lineDiff / foldContext", () => {
  it("keeps common lines and marks removed and added ones", () => {
    expect(lineDiff("a\nb\nc", "a\nx\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "add", text: "x" },
      { kind: "same", text: "c" },
    ]);
    expect(lineDiff("", "a")).toEqual([
      { kind: "del", text: "" },
      { kind: "add", text: "a" },
    ]);
    expect(lineDiff("same", "same")).toEqual([{ kind: "same", text: "same" }]);
  });

  it("folds long unchanged runs, keeping context around a change", () => {
    const before = ["1", "2", "3", "4", "5", "6", "7"].join("\n");
    const after = ["1", "2", "3", "4", "5", "6", "X"].join("\n");
    expect(foldContext(lineDiff(before, after), 2)).toEqual([
      { kind: "skip", count: 4 },
      { kind: "same", text: "5" },
      { kind: "same", text: "6" },
      { kind: "del", text: "7" },
      { kind: "add", text: "X" },
    ]);
  });
});
