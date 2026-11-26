import { describe, it, expect } from "vitest";
import type { ConventionCandidate } from "@devdigest/shared";
import { bulkAction, isKnownScanError, stableOrder } from "./helpers";

const c = (id: string, status: ConventionCandidate["status"]) => ({ id, status }) as ConventionCandidate;

describe("ConventionsView helpers", () => {
  it("orders by confidence, then age, rule and id — never by status", () => {
    const k = (id: string, status: ConventionCandidate["status"], confidence: number, created_at: string, rule = "r") =>
      ({ id, status, confidence, created_at, rule }) as ConventionCandidate;
    const list = [
      k("1", "rejected", 0.9, "2026-11-26T10:00:00Z"),
      k("2", "pending", 0.7, "2026-11-26T09:00:00Z"),
      k("3", "accepted", 0.9, "2026-11-26T09:00:00Z"),
      k("4", "pending", 0.9, "2026-11-26T09:00:00Z", "a"),
    ];
    expect(stableOrder(list).map((x) => x.id)).toEqual(["4", "3", "1", "2"]);
    expect(list.map((x) => x.id)).toEqual(["1", "2", "3", "4"]); // input untouched
  });

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
