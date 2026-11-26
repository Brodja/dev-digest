---
name: engineering-insights
description: "Reads and appends to the per-package INSIGHTS.md logs of this repo (client, server, reviewer-core, e2e). Use at the start of any coding, debugging, review or code-explanation task here, once the task is known, to read the INSIGHTS.md of the packages involved; and again when the task is done, before the final report, to append new dated insights with file:line evidence: non-obvious dependencies, fixes (cause → solution), measured facts (numbers, timings, tokens, test results) and surprising findings in the code. Use proactively without being asked; also on /engineering-insights, 'wrap up', 'capture learnings', 'what did we learn'."
argument-hint: "[client|server|reviewer-core|e2e]"
---

# Engineering insights

Each package keeps a short, append-only log of what a future agent could not see by reading the code:
`client/INSIGHTS.md`, `server/INSIGHTS.md`, `reviewer-core/INSIGHTS.md`, `e2e/INSIGHTS.md`.
This skill reads them before the work and adds to them after it. Its instructions hold for the whole task, not only the moment it loads.

## Which log

| Work touches | Log |
|---|---|
| `client/**` | `client/INSIGHTS.md` |
| `server/**` (incl. `modules/repo-intel`, `vendor/shared`, db scripts) | `server/INSIGHTS.md` |
| `reviewer-core/**` | `reviewer-core/INSIGHTS.md` |
| `e2e/**` | `e2e/INSIGHTS.md` |

Several packages → several logs. Root-only work (CI, `docker-compose.yml`, `scripts/`) → the package whose behaviour it changes.
If invoked with an argument (`/engineering-insights server`), use only that package.

## 1. Start — as soon as the task is known

1. Pick the package(s) from the task and from the files you expect to touch or explain.
2. Read each chosen INSIGHTS.md in full.
3. Say in one line which entries apply to this task, or that none do — proof the log was read.
4. Treat entries as strong hints, not facts: before relying on one, check that its `path:line` still shows what the entry says.

## 2. During work — notice, don't write yet

Keep a running list of candidates and capture the evidence when you see it (`path:line`, the command and its output, the number) — it is hard to reconstruct later.

- `dependency` — a non-obvious link: changing A breaks or requires B; hidden ordering, env var, cross-package coupling.
- `fix` — a bug you fixed or worked around, as symptom — cause → fix.
- `measured` — a number you actually measured: time, tokens, cost, test counts, sizes — with the conditions (command, OS, model).
- `oddity` — code that does something other than its name, comment or docs suggest; a trap; dead or duplicated logic.

When the user corrects your approach, that correction is a prime candidate.

## 3. End — before the final report

Run this step on every task; writing is conditional.

1. **Filter.** Keep a candidate only if all hold:
   - a competent agent reading the code at that spot would not see it within a few minutes;
   - it changes what a future agent does, or saves it 5+ minutes;
   - it is specific to this repo, not general TypeScript/React/SQL knowledge;
   - it is not already in that package's `AGENTS.md`, `README.md`, `docs/`, or the root `AGENTS.md`;
   - you can cite a `path:line` you opened and checked in this task.

   Usually 0–3 entries per task; more than 5 means you are writing a diary.
2. **Dedupe.** Re-read the target INSIGHTS.md now — another session may have written to it. Skip a candidate an existing entry already covers, even in other words. If your finding corrects an older entry, append a new one starting with `supersedes YYYY-MM-DD:` — never edit the old line.
3. **Append** each entry with the helper. Never use Write or Edit on INSIGHTS.md.

   ```sh
   bash .claude/skills/engineering-insights/scripts/append-insight.sh <package> <category> "<insight>" "<path:line>[, <path:line>…]"
   ```

   It adds today's date, checks that every `path:line` exists, refuses evidence that is already logged verbatim, and only ever appends. If it rejects an entry, fix the entry — don't work around the script.
4. **Report.** In the final message list the appended lines, or say `engineering-insights: nothing new`. A human spot-checks them. If a log has grown past ~100 entries, say it needs a consolidation pass — that is not this skill's job.

## Entry format

`- YYYY-MM-DD · category · insight · path:line`

- One line. Paths repo-root-relative with `/`; ranges `path:12-30`; several refs comma-separated.
- Name the symbol (function, constant, component) in the insight so the entry survives line drift.
- Write it to be acted on cold: what is true, why it matters, what to do about it.
- English. No secrets, tokens or personal data.

Good:

- `- 2026-11-21 · dependency · RunBus keeps run events only in memory: after an API restart the SSE log of earlier runs is gone and runs still 'running' are set to failed by reapStaleRuns on boot — read GET /runs/:id/trace, not the stream · server/src/platform/sse.ts:19, server/src/app.ts:82`
- `- 2026-11-21 · fix · db:migrate and db:seed silently did nothing on Windows: the entry-point check built a file:// URL by hand (backslashes, drive letter, %20) → compare import.meta.url with pathToFileURL(process.argv[1]).href · server/src/db/migrate.ts:38, server/src/db/seed.ts:229`
- `- 2026-11-21 · oddity · The review score is not the model's: scoreFromFindings recomputes it from grounded findings (100 − 35·CRITICAL − 12·WARNING − 3·SUGGESTION), so prompt edits asking for another score change nothing · reviewer-core/src/review/reduce.ts:27`

Bad — don't write:

- `SSE is tricky` — vague, no action, no evidence.
- `server typecheck needs reviewer-core/node_modules` — already in the root AGENTS.md.
- `Added RunCostBadge to the PR header` — a changelog line; git log already has it.
- `measured · tests pass` — no number, no conditions.
