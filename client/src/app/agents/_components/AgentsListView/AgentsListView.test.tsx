import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AgentListItem } from "@devdigest/shared";
import agents from "../../../../../messages/en/agents.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const agent = (id: string, name: string, skill_count: number): AgentListItem => ({
  id,
  name,
  description: "d",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "p",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
  skill_count,
});
const LIST = [agent("a1", "API Contract Reviewer", 4), agent("a2", "General Reviewer", 0), agent("a3", "Solo", 1)];

vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({ data: LIST, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateAgent: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { AgentsListView } from "./AgentsListView";

afterEach(cleanup);

describe("AgentsListView (/agents)", () => {
  it("passes each agent's skill count to its card", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ agents }}>
        <AgentsListView />
      </NextIntlClientProvider>,
    );
    const card = (name: string) => within(screen.getByText(name).parentElement!.parentElement!);
    expect(card("API Contract Reviewer").getByText("4 skills")).toBeInTheDocument();
    expect(card("General Reviewer").getByText("0 skills")).toBeInTheDocument();
    expect(card("Solo").getByText("1 skill")).toBeInTheDocument();
  });
});
