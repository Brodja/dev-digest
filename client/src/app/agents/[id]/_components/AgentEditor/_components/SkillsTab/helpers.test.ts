import { describe, it, expect } from "vitest";
import type { AgentSkillLink, Skill } from "@devdigest/shared";
import { linkedRows, moveItem, toLinkInputs } from "./helpers";

const skill = (id: string): Skill => ({
  id,
  name: `skill-${id}`,
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

describe("linkedRows", () => {
  it("sorts links by order, joins the skill and skips unknown ids", () => {
    const links: AgentSkillLink[] = [
      { agent_id: "ag", skill_id: "b", order: 1, enabled: false },
      { agent_id: "ag", skill_id: "gone", order: 2, enabled: true },
      { agent_id: "ag", skill_id: "a", order: 0, enabled: true },
    ];
    const rows = linkedRows(links, [skill("a"), skill("b")]);
    expect(rows.map((r) => [r.skill.id, r.enabled])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(toLinkInputs(rows)).toEqual([
      { skill_id: "a", enabled: true },
      { skill_id: "b", enabled: false },
    ]);
  });
});
