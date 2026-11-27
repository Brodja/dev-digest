import { describe, it, expect } from "vitest";
import type { AgentSkillLink, Skill } from "@devdigest/shared";
import { moveItem, splitRows, toggleLink, toLinkInputs } from "./helpers";

const skill = (id: string, name = `skill-${id}`): Skill => ({
  id,
  name,
  description: "d",
  type: "custom",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
  evidence_files: null,
  trusted: true,
});

describe("moveItem", () => {
  it("moves an item up or down", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"]);
  });

  it("returns an unchanged copy for a no-op or out-of-range move", () => {
    const list = ["a", "b"];
    expect(moveItem(list, 1, 1)).toEqual(list);
    expect(moveItem(list, 0, 5)).toEqual(list);
    expect(moveItem(list, -1, 0)).toEqual(list);
    expect(moveItem(list, 0, 1)).not.toBe(list);
  });
});

describe("splitRows", () => {
  it("puts the enabled links first by order, then every other skill by name; unknown ids are skipped", () => {
    const links: AgentSkillLink[] = [
      { agent_id: "ag", skill_id: "b", order: 1, enabled: false },
      { agent_id: "ag", skill_id: "gone", order: 2, enabled: true },
      { agent_id: "ag", skill_id: "c", order: 3, enabled: true },
      { agent_id: "ag", skill_id: "a", order: 0, enabled: true },
    ];
    const { linked, rest } = splitRows(links, [skill("a"), skill("b", "zeta"), skill("c"), skill("d", "alpha")]);
    expect(linked.map((sk) => sk.id)).toEqual(["a", "c"]);
    // b's link is off: it is with the rest, unchecked.
    expect(rest.map((sk) => sk.name)).toEqual(["alpha", "zeta"]);
  });
});

describe("toggleLink / toLinkInputs", () => {
  it("appends a newly checked skill and drops an unchecked one", () => {
    expect(toggleLink(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(toggleLink(["a", "b"], "a")).toEqual(["b"]);
  });

  it("sends every linked skill enabled, in order", () => {
    expect(toLinkInputs(["b", "a"])).toEqual([
      { skill_id: "b", enabled: true },
      { skill_id: "a", enabled: true },
    ]);
  });
});
