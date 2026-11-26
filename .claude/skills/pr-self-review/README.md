# pr-self-review — provenance & sources

A local, manual-only skill (`disable-model-invocation: true`): you run `/pr-self-review [base-ref]` before opening a PR. Version and changelog: [SKILL.md](SKILL.md#changelog).

## Files

| File | Role |
|------|------|
| `SKILL.md` | five-step procedure, boundaries |
| `routing.md` | scope (base, diff, added lines), surfaces → skills, per-package checks, tags |
| `severity.md` | scale, NEW vs OLD, closed CRITICAL catalog, general check, skill mapping, skeptic pass |
| `report.md` | `.pr-self-review.md` layout, PR description draft, chat summary |
| `scripts/lib.mjs` | git scope helpers shared by the two scripts (Node builtins only) |
| `scripts/scope.mjs` | step 1: prints scope, checks to run, hard flags |
| `scripts/depcruise-changed.mjs` | runs the `onion-architecture` gate, keeps violations in changed files, classifies NEW/OLD |

## Sources

- Lecturer's reference: `upstream/lesson-2-lab/skills` @ `a8a4935`, `.claude/skills/pr-self-review/` (SKILL.md, routing.md, gate.md, scripts). Kept: added-lines-only review, routing by surface, closed CRITICAL catalog, adversarial verification of CRITICALs. Left out: the PreToolUse hook, `.pr-self-review.json` state, diff hash and override (L06), the HIGH/MEDIUM scale, skills and agents this repo doesn't have (`vercel-react-best-practices`, `nodejs-best-practices`, `react-architecture-analyzer`, `code-reviewer`), and the "vendored contract copies differ → CRITICAL" rule (4 copies already differ).
- Claude Code docs, Skills — frontmatter (`disable-model-invocation`, `argument-hint`) and `$ARGUMENTS`: https://code.claude.com/docs/en/skills
- Project rules it enforces: root `AGENTS.md` (do-not-touch, package managers), `server/AGENTS.md` (Zod in route schema, contract mirroring, migrations), `client/INSIGHTS.md` and `server/INSIGHTS.md` (2026-11-21 entries cited in severity.md), the `onion-architecture` gate (`.claude/skills/onion-architecture/depcruise.config.cjs`).
- dependency-cruiser JSON output and rules — https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md

## Verification log

The procedure was followed by hand: the model can't invoke a `disable-model-invocation` skill itself.

- 2026-11-26, `lab/l02-harness`, base `origin/main` (30 files, all surface `rest`) → **READY**: 0 CRITICAL, 0 WARNING, 2 SUGGESTION. No package checks were triggered and depcruise was skipped. The general check passed: 4 SKILL.md valid, no secrets, no broken links. `-C` made the moved `AGENTS.md` count only its 2 really changed lines.
- 2026-11-26, throwaway detached worktree (Windows; `node_modules` linked by junctions), base `lab/l02-harness`. Planted: `agents/service.ts` builds `SimpleGitClient` directly (staged), and a value import of `@devdigest/shared` in `FindingsPanel/constants.ts` (unstaged). Result: **NOT READY**, 2 CRITICAL.
  - depcruise-changed: `CRITICAL services-depend-on-ports service.ts:13`, with 20 untouched violations ignored.
  - The client plant passed tsc and 76/76 tests and was caught only by the review (catalog item, skeptic pass CONFIRMED).
  - The 8 Windows-only server test failures landed in pre-existing.
  - Fix found by this run: a depcruise CRITICAL used to skip the LLM review (step 2). Now only a typecheck error skips it.
