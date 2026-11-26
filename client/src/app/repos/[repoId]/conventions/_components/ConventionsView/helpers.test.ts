import { describe, it, expect } from "vitest";
import type { ConventionCandidate } from "@devdigest/shared";
import { bulkAction, isKnownScanError } from "./helpers";

const c = (id: string, status: ConventionCandidate["status"]) => ({ id, status }) as ConventionCandidate;

describe("ConventionsView helpers", () => {
  it("Select all accepts every candidate still to review, leaving rejected ones alone", () => {
    expect(bulkAction([c("1", "accepted"), c("2", "pending"), c("3", "rejected"), c("4", "pending")])).toEqual({
      kind: "select",
      ids: ["2", "4"],
      status: "accepted",
    });
  });

  it("once nothing is left to review, Deselect all moves the accepted ones back", () => {
    expect(bulkAction([c("1", "accepted"), c("2", "rejected"), c("3", "accepted")])).toEqual({
      kind: "deselect",
      ids: ["1", "3"],
      status: "pending",
    });
  });

  it("offers nothing when there is nothing to select or deselect", () => {
    expect(bulkAction([])).toBeNull();
    expect(bulkAction([c("1", "rejected")])).toBeNull();
  });

  it("knows the scan error codes it explains itself", () => {
    expect(isKnownScanError("repo_not_indexed")).toBe(true);
    expect(isKnownScanError("llm_failed")).toBe(false);
    expect(isKnownScanError(null)).toBe(false);
  });
});
