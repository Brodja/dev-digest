import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AgentSkillLink } from "@devdigest/shared";
import { hasLocalErrorToast } from "../mutation-meta";

const put = vi.fn();
vi.mock("../api", () => ({ api: { put: (...args: unknown[]) => put(...args) } }));

import { useSetAgentSkills } from "./agents";

afterEach(() => {
  cleanup();
  put.mockReset();
});

const KEY = ["agent-skills", "ag1"];
const BEFORE: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "a", order: 0, enabled: true },
  { agent_id: "ag1", skill_id: "b", order: 1, enabled: true },
];
const NEXT = [
  { skill_id: "b", enabled: true },
  { skill_id: "a", enabled: false },
];
const OPTIMISTIC: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "b", order: 0, enabled: true },
  { agent_id: "ag1", skill_id: "a", order: 1, enabled: false },
];

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(KEY, BEFORE);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSetAgentSkills(), { wrapper });
  return { qc, result };
}

/** A promise the test settles by hand, to look at the cache in between. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useSetAgentSkills", () => {
  it("applies the change at once, then rolls it back when the server refuses", async () => {
    const d = deferred<AgentSkillLink[]>();
    put.mockReturnValue(d.promise);
    const { qc, result } = setup();

    act(() => result.current.mutate({ agentId: "ag1", links: NEXT }));
    await waitFor(() => expect(qc.getQueryData(KEY)).toEqual(OPTIMISTIC));
    expect(put).toHaveBeenCalledWith("/agents/ag1/skills", { links: NEXT });

    await act(async () => {
      d.reject(new Error("Unknown skill for this workspace"));
      await d.promise.catch(() => undefined);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(KEY)).toEqual(BEFORE);
  });

  it("keeps the server's answer on success", async () => {
    const saved: AgentSkillLink[] = OPTIMISTIC.map((l) => ({ ...l }));
    put.mockResolvedValue(saved);
    const { qc, result } = setup();
    await act(async () => {
      await result.current.mutateAsync({ agentId: "ag1", links: NEXT });
    });
    expect(qc.getQueryData(KEY)).toEqual(saved);
  });

  it("opts out of the global error toast (the Skills tab shows its own)", () => {
    const { qc, result } = setup();
    put.mockReturnValue(new Promise(() => {}));
    act(() => result.current.mutate({ agentId: "ag1", links: NEXT }));
    const mutation = qc.getMutationCache().getAll()[0]!;
    expect(hasLocalErrorToast(mutation.meta)).toBe(true);
  });
});

describe("hasLocalErrorToast", () => {
  it("is true only for the explicit flag", () => {
    expect(hasLocalErrorToast({ localErrorToast: true })).toBe(true);
    expect(hasLocalErrorToast({ localErrorToast: "yes" })).toBe(false);
    expect(hasLocalErrorToast(undefined)).toBe(false);
  });
});
