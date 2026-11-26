# e2e — `@devdigest/e2e`

Deterministic browser flows for the web app, run by the **Vercel agent-browser** CLI (Rust + CDP).
**Not Playwright** — don't add Playwright or its config; `playwright-report/` in `.gitignore` is a leftover.

Read first: [INSIGHTS.md](INSIGHTS.md). More: [README.md](README.md) (how flows work, coverage table) ·
[docs/](docs/README.md) · [../TESTING.md](../TESTING.md)

## Layout

- `specs/NN-name.flow.json` — the **tests**, not specification docs. Notes about e2e go to `docs/`.
- `run.ts` — runner: executes each flow's steps in order in one shared browser session.
- `lib/assert.ts` — extra stdout checks and result bookkeeping.

## Commands

- Default: `npm run e2e:hermetic` (= `../scripts/e2e.sh`) — isolated seeded stack on :5433 / :3101 / :3100, torn down afterwards.
- `npm test` only against a freshly seeded DB: flows 02/04/05 assume the demo repo is the only one.
- One-time setup: `npm i -g agent-browser && agent-browser install`.

## Writing a flow

- Shape: `{ "name", "description", "steps": [{ "cmd": [...], "label", "assert"? }] }`; `{BASE}` → `E2E_BASE_URL`.
- Assertions are `wait --url` / `wait --text` (a non-zero exit fails the step); optional `assert.stdoutIncludes`.
- Deterministic locators only (`--url`, `--text`, `find role|text|label`); never the AI `chat` command.
- Read-only over seeded data (`acme/payments-api`, PR #482) — a flow must never trigger an LLM call.

## Do not touch

- Your dev DB — never `docker compose down -v` to "reset" it; use the hermetic runner instead.
- `test-results/` — failure screenshots, git-ignored.
