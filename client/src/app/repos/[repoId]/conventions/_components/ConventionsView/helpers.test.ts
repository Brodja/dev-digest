import { describe, it, expect } from "vitest";
import type { ConventionCandidate } from "@devdigest/shared";
import { groupByStatus, isKnownScanError } from "./helpers";

const c = (id: string, status: ConventionCandidate["status"]) => ({ id, status }) as ConventionCandidate;

describe("ConventionsView helpers", () => {
  it("groups by status and keeps the server order inside each group", () => {
    const g = groupByStatus([c("1", "accepted"), c("2", "pending"), c("3", "accepted"), c("4", "rejected")]);
    expect(g.accepted.map((x) => x.id)).toEqual(["1", "3"]);
    expect(g.pending.map((x) => x.id)).toEqual(["2"]);
    expect(g.rejected.map((x) => x.id)).toEqual(["4"]);
  });

  it("knows the scan error codes it explains itself", () => {
    expect(isKnownScanError("repo_not_indexed")).toBe(true);
    expect(isKnownScanError("llm_failed")).toBe(false);
    expect(isKnownScanError(null)).toBe(false);
  });
});
