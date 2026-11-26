import { describe, it, expect } from "vitest";
import type { ConventionCandidate } from "@devdigest/shared";
import { composeSkillDraft, freeSkillName } from "./helpers";

const c = (id: string, rule: string, start: number, end: number): ConventionCandidate => ({
  id,
  rule,
  evidence_path: `src/${id}.ts`,
  evidence_snippet: `const secret${id} = "SNIPPET-${id}";`,
  confidence: 0.8,
  accepted: true,
  status: "accepted",
  evidence_start_line: start,
  evidence_end_line: end,
  commit_sha: "abc",
  created_at: "2026-11-26T10:00:00.000Z",
});

describe("composeSkillDraft", () => {
  const accepted = [c("a", "Throw NotFoundError from services.", 12, 14), c("b", "Name files in kebab-case.", 3, 3)];

  it("lists the given rules in order with their evidence references, and no code snippets", () => {
    const draft = composeSkillDraft("acme/api", accepted, []);
    expect(draft).toMatchObject({ name: "repo-conventions", type: "convention", enabled: true });
    expect(draft.description).toContain("acme/api");
    expect(draft.body.startsWith("# repo-conventions\n")).toBe(true);
    expect(draft.body).toContain("1. Throw NotFoundError from services. — seen in `src/a.ts:L12-L14`");
    expect(draft.body).toContain("2. Name files in kebab-case. — seen in `src/b.ts:L3`");
    expect(draft.body).not.toContain("SNIPPET-");
  });

  it("picks a free name when repo-conventions is taken", () => {
    expect(composeSkillDraft("acme/api", accepted, ["repo-conventions"]).name).toBe("repo-conventions-2");
    expect(freeSkillName("repo-conventions", ["repo-conventions", "repo-conventions-2"])).toBe("repo-conventions-3");
  });

  it("stays within the skill body limit for a long list", () => {
    const many = Array.from({ length: 100 }, (_, i) => c(String(i), `Rule number ${i} that the team follows everywhere.`, i + 1, i + 2));
    expect(composeSkillDraft("acme/api", many, []).body.length).toBeLessThan(40_000);
  });
});
