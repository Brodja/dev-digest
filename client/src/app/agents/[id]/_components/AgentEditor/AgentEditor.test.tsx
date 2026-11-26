import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../../messages/en/agents.json";
import { ToastProvider } from "../../../../../lib/toast";

// Mock the data hooks so the editor renders without a network/query client.
vi.mock("../../../../../lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, data: undefined }),
  useProviderModels: () => ({ data: [{ id: "gpt-4.1", provider: "openai" }] }),
  useAgentSkills: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useSetAgentSkills: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({
    data: [
      {
        id: "s1",
        name: "secret-leakage-gate",
        description: "d",
        type: "security",
        source: "manual",
        body: "b",
        enabled: true,
        version: 1,
        trusted: true,
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { AgentEditor } from "./AgentEditor";

afterEach(cleanup);

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("A2 Agent Editor (smoke)", () => {
  it("renders the Config tab fields", () => {
    renderWithIntl(<AgentEditor agent={AGENT} tab="config" onTab={() => {}} />);
    expect(screen.getByText("Config")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Save agent")).toBeInTheDocument();
  });

  it("has a Skills tab; switching tabs keeps unsaved Config edits", () => {
    const ui = (tab: string) => (
      <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
        <ToastProvider>
          <AgentEditor agent={AGENT} tab={tab} onTab={() => {}} />
        </ToastProvider>
      </NextIntlClientProvider>
    );
    const { rerender } = render(ui("config"));
    expect(screen.getByText("Skills")).toBeInTheDocument(); // tab label
    const name = screen.getByDisplayValue("Security Reviewer");
    fireEvent.change(name, { target: { value: "Renamed, not saved" } });

    rerender(ui("skills"));
    expect(screen.getByText(/Order matters/)).toBeInTheDocument();
    expect(screen.getByText("Configuration").closest("[aria-hidden='true']")).not.toBeNull();

    rerender(ui("config"));
    expect(screen.queryByText(/Order matters/)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Renamed, not saved")).toBeInTheDocument();
  });
});
