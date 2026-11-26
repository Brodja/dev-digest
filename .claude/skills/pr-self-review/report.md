# Report — `.pr-self-review.md` and the PR draft

Overwrite `.pr-self-review.md` at the repo root on every run (git-ignored, local only). Keep this shape, so a later L06 hook can read the verdict line.

```markdown
# PR self-review — <branch>

Verdict: READY | NOT READY — не відкривай PR
Base: <ref> @ <sha7> · Head: <sha7> (+ uncommitted) · Run: <YYYY-MM-DD HH:MM>
Counts: CRITICAL <n> · WARNING <n> · SUGGESTION <n> · downgraded <n> · pre-existing <n>

## Checks
| Check | Result |
|-------|--------|
| client typecheck | pass / FAIL (NEW) / skipped |
| server unit tests | 162 passed, 8 failed (OLD) |
| depcruise (changed files) | 0 CRITICAL · 1 WARNING · 2 OLD |

## Findings — <surface>   (one section per surface with files; omit empty ones)
| Severity | Where | Skill | Issue | Fix |
|----------|-------|-------|-------|-----|
| CRITICAL | path/to/file.ts:42 | onion-architecture | … | … |

## Downgraded by the skeptic pass
- path:line — <original claim> — downgraded: <reason>

## Pre-existing (not counted)
- <OLD test failures, OLD depcruise lines, problems seen in untouched code>

## PR description draft   (READY only)
…
```

## PR description draft (READY only)

Written in English, ready to paste into `gh pr create --body-file`:

```markdown
## Summary
<1–3 bullets: what changed and why, from the commits and the diff>

## Changes
- **<surface>:** <what changed, by area>

## Checks
- <each deterministic check and its result, e.g. `client: pnpm typecheck, pnpm test — pass`>
- pr-self-review: READY · <n> warnings (listed below)

## Known warnings
- <WARNING findings left on purpose, with file:line>
```

Leave out the attribution footer: whoever opens the PR adds it.

## Chat summary

Short, in the user's language. Give the verdict line, counts per severity, each CRITICAL as `file:line — issue — fix`, and the path to `.pr-self-review.md`. On READY, say the PR draft is in the report.
