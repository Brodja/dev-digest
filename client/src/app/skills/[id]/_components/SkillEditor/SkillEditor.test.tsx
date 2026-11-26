import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useSkillVersions: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useRestoreSkillVersion: () => ({ mutate: vi.fn(), isPending: false }),
  useSkillStats: () => ({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() }),
}));

import { SkillEditor } from "./SkillEditor";

afterEach(cleanup);

const SKILL: Skill = {
  id: "s1",
  name: "owasp-strict",
  description: "Flag OWASP issues.",
  type: "security",
  source: "imported_file",
  body: "- rule one",
  enabled: false,
  version: 3,
  evidence_files: null,
  trusted: false,
};

/** Controlled host, like the page (?tab= state). */
function Host() {
  const [tab, setTab] = React.useState("config");
  return (
    <NextIntlClientProvider locale="en" messages={{ skills }}>
      <ToastProvider>
        <SkillEditor skill={SKILL} tab={tab} onTab={setTab} />
      </ToastProvider>
    </NextIntlClientProvider>
  );
}

describe("SkillEditor (skill page)", () => {
  it("heads the page with name, type, version, source and the untrusted / disabled marks", () => {
    render(<Host />);
    const h1 = screen.getByRole("heading", { level: 1, name: "owasp-strict" });
    const header = within(h1.parentElement!);
    expect(header.getByText("security")).toBeInTheDocument();
    expect(header.getByText("v3")).toBeInTheDocument();
    expect(header.getByText("Imported (file)")).toBeInTheDocument();
    expect(header.getByText("untrusted")).toBeInTheDocument();
    expect(header.getByText("disabled")).toBeInTheDocument();
  });

  it("has exactly the Config, Preview, Versions and Stats tabs", () => {
    render(<Host />);
    for (const name of ["Config", "Preview", "Versions", "Stats"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /^Evals/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Context/ })).not.toBeInTheDocument();
  });

  it("switching tabs keeps unsaved Config edits", () => {
    render(<Host />);
    fireEvent.change(screen.getByRole("textbox", { name: "Skill body" }), { target: { value: "- edited" } });
    fireEvent.click(screen.getByRole("button", { name: /^Preview/ }));
    expect(screen.getByRole("heading", { name: "Preview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Config/ }));
    expect(screen.getByRole("textbox", { name: "Skill body" })).toHaveValue("- edited");
    expect(screen.getByText("unsaved")).toBeInTheDocument();
  });
});
