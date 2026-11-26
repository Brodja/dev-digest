import type { ConventionCandidate } from "@devdigest/shared";
import type { SkillFormValues } from "@/components/SkillForm";
import { lineRef } from "@/app/repos/[repoId]/conventions/helpers";

export const DEFAULT_SKILL_NAME = "repo-conventions";

/** `base`, or `base-2`, `base-3`, … — the first name the workspace does not have yet. */
export function freeSkillName(base: string, taken: readonly string[]): string {
  const names = new Set(taken);
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base}-${i}`)) return `${base}-${i}`;
}

/**
 * The editable draft of a skill built from accepted conventions
 * (server/specs/003-conventions.md → Skill from conventions): rules with their
 * evidence references, NO code snippets — the skill is a trusted source, so
 * repository code in its body would reach the prompt without the <untrusted>
 * wrapper. Only the conventions passed in are used (the caller passes accepted ones).
 */
export function composeSkillDraft(
  repoName: string,
  conventions: readonly ConventionCandidate[],
  takenNames: readonly string[],
): SkillFormValues {
  const name = freeSkillName(DEFAULT_SKILL_NAME, takenNames);
  const rules = conventions.map(
    (c, i) => `${i + 1}. ${c.rule} — seen in \`${c.evidence_path}:${lineRef(c)}\``,
  );
  return {
    name,
    description: `Flag changes that break the house conventions of ${repoName} listed below; cite the convention and the offending file:line.`,
    type: "convention",
    enabled: true,
    body: [
      `# ${name}`,
      "",
      `House conventions of \`${repoName}\`, extracted from its code and accepted by the team.`,
      "Flag changed code that breaks any rule below; cite the rule number and the offending file:line.",
      "",
      ...rules,
    ].join("\n"),
  };
}
