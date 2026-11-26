import { describe, it, expect } from "vitest";
import { filterSkills } from "./skill-search";

const skills = [
  { name: "secret-leakage-gate", description: "Flag secrets.", type: "security" },
  { name: "pr-quality-rubric", description: "Score PR quality.", type: "rubric" },
];

describe("filterSkills", () => {
  it("matches name, description or type, case-insensitively", () => {
    expect(filterSkills(skills, "SECRET").map((s) => s.name)).toEqual(["secret-leakage-gate"]);
    expect(filterSkills(skills, "score").map((s) => s.name)).toEqual(["pr-quality-rubric"]);
    expect(filterSkills(skills, "rubric").map((s) => s.name)).toEqual(["pr-quality-rubric"]);
  });

  it("keeps everything for a blank query and nothing for a miss", () => {
    expect(filterSkills(skills, "  ")).toHaveLength(2);
    expect(filterSkills(skills, "nope")).toEqual([]);
  });
});
