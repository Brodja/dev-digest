---
name: pr-self-review
description: "Manual pre-PR self-review of the current branch against main: committed, staged, unstaged and untracked changes. Runs typecheck, unit tests and the onion dependency gate for the changed packages, routes each changed surface (client, server/reviewer-core, e2e, rest) to the project skills, reports CRITICAL/WARNING/SUGGESTION findings with file:line, and ends with READY or NOT READY. Run as /pr-self-review [base-ref] before opening a PR."
disable-model-invocation: true
argument-hint: "[base-ref]"
version: "1.0.1"
---

# PR self-review — before you open a PR

Reviews everything on this branch that is not on main yet, and tells you whether to open the PR. It is **read-only**: it reports and suggests fixes, but never edits code, commits or pushes. Base: `$ARGUMENTS` if given, else `origin/main`, else `main`.

Reference files: [routing.md](routing.md) (scope, surfaces, skills) · [severity.md](severity.md) (scale, CRITICAL catalog, NEW vs OLD) · [report.md](report.md) (report and PR draft) · sources in [README.md](README.md).

## Procedure

1. **Scope.** Run `node .claude/skills/pr-self-review/scripts/scope.mjs $ARGUMENTS` from the repo root. It prints the base, every changed file with its surface, added lines, tags and skills, the deterministic checks to run, and the hard flags. If there are no changes, write a READY report and stop.
2. **Deterministic checks first.** Run the commands that scope printed, in order. If backend code changed, scope also lists `depcruise-changed.mjs`; run it too. Classify every failure as NEW or OLD ([severity.md §2](severity.md#2-new-vs-old-deterministic-checks)). Any NEW failure is a CRITICAL. Only a NEW **typecheck** error skips step 3 (go straight to step 5): there is no point reviewing a tree that doesn't compile. A NEW test failure or depcruise CRITICAL does not skip it, so one run reports every problem.
3. **Review each surface.** For each surface in the scope, load only the skills listed for its files (Skill tool), and read that package's `INSIGHTS.md` as extra criteria. Review **only the added lines** that scope printed; read the code around them for context. Run the general check ([severity.md §4](severity.md#4-general-check-every-surface)) on every surface. Record each finding as `severity · file:line · skill · issue · fix`, mapped with [severity.md §3 and §5](severity.md#3-closed-critical-catalog).
4. **Skeptic pass.** Collect the CRITICALs that *you* judged (not the deterministic ones from steps 1–2). Give them to one subagent (Agent tool) together with the cited code, and ask it to refute each one ([severity.md §6](severity.md#6-skeptic-pass)). A CRITICAL it refutes becomes a WARNING marked `downgraded: <reason>`. Never drop it silently.
5. **Verdict and report.** Any CRITICAL left → **`NOT READY — не відкривай PR`**; otherwise **`READY`**. Overwrite `.pr-self-review.md` at the repo root (git-ignored) using [report.md](report.md). On READY, include the PR description draft. Print a short summary in chat: the verdict, counts per severity, and every CRITICAL with file:line.

## Boundaries

- No hooks and no merge blocking: this is advice you run by hand (enforcement comes in L06).
- Findings must point at added lines. Problems in untouched code go to the OLD section, never to the verdict.
- Don't fix anything during the run. If the user asks for fixes afterwards, that is a new task.

## Changelog

- **1.0.1** (2026-11-26) — Fix a false CRITICAL `migration-edit` on `server/src/db/migrations/meta/_journal.json`: `db:generate` appends to the journal for every new migration, so a journal change that comes with a new `.sql` is now `migration-new`. `migration-edit` stays for a changed or deleted `.sql` or snapshot, and for a journal change without a new `.sql`.
- **1.0.0** (2026-11-26) — First version for DevDigest L02 (A4). Manual only. Severity scale matches the findings contract. Deterministic checks run before the LLM pass, with an OLD bucket for pre-existing failures. The depcruise gate counts only violations in changed files. Skeptic pass on CRITICALs, PR draft on READY, report in `.pr-self-review.md`. Adapted from the lecturer's reference (`upstream/lesson-2-lab/skills`), without its hook, state file and diff hash.
