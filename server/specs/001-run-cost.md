# 001 — Run cost

Show what each agent run cost (USD) and how many tokens it used, on three screens:
the Pull Requests list, the PR's Agent runs tab, and the Agent run (trace) sidebar.
Spans server + client; this file is the spec, `client/specs/001-run-cost.md` links here.

## Why

`reviewPullRequest` already returns `costUsd` (`reviewer-core/src/review/run.ts`), but the server
dropped it: `agent_runs` had no cost column and `ReviewRunExecutor` only persisted tokens. Cost is
the first per-run metric of the course; it must come from data we already have — **no extra model calls**.

## Where the number comes from

No change in reviewer-core. Per LLM call the provider returns `costUsd`; the engine sums them per run.

| Provider | Cost source |
|---|---|
| Anthropic / OpenAI | estimate: tokens × static `PRICING` (`server/src/adapters/llm/pricing.ts`) |
| OpenRouter | billed `usage.cost`; fallback PriceBook live price, then the static table |

A model without a price → `null`. If any chunk of a map-reduce run returns `null`, the whole run's cost is `null`.

## Data

- `agent_runs.cost_usd double precision NULL` — USD for the whole run (sum of all its LLM calls).
- Written only when `status = 'done'`. `failed`, `cancelled`, `running`, reaped-on-boot → `NULL`.
- Runs recorded before this feature stay `NULL`.
- Schema change via `src/db/schema/runs.ts` → `pnpm db:generate`; migration SQL is never hand-edited.

## API (snake_case, USD, `null` = unknown)

| Route | Field | Value |
|---|---|---|
| `GET /pulls/:id/runs` | `RunSummary.cost_usd` | `agent_runs.cost_usd` |
| `GET /runs/:id/trace` | `RunTrace.stats.cost_usd` (nullish — old trace documents lack it) | same number, stored in the trace document |
| `GET /repos/:id/pulls` | `PrMeta.cost_usd` (nullish, list endpoint only) | **PR total**: `SUM(agent_runs.cost_usd)` over the PR's runs with `status = 'done'` and `cost_usd IS NOT NULL`; `null` when there is no such run. Equals the sum of the cost badges in the Agent runs Timeline. The score ring next to it stays the **latest review's** score |

The run's Live log gets one line on success: `Cost: $<full precision> (<in>→<out> tokens)`,
or `Cost: unknown (no price for <model>)`.

## Format — `formatCost` (one helper for the whole client)

| Input | Output |
|---|---|
| `null` / `undefined` / NaN / negative | `—` |
| `0` (free model) | `$0` |
| `< 0.0001` | `<$0.0001` |
| `< 1` | 3 significant digits, trailing zeros trimmed, at least 2 decimals: `0.0814 → $0.0814`, `0.014 → $0.014`, `0.5 → $0.50`, `0.12345 → $0.123` |
| `≥ 1` | 2 decimals: `$1.23` |

The full, unrounded number is in the badge tooltip (`title`) so it can be compared with the Live log line.

## UI — `RunCostBadge` (`client/src/components/RunCostBadge/`)

- `compact` → `$0.014` — PR list, Review run header, trace sidebar.
- `detailed` → `9,119 tok · $0.0814` — Timeline row (tokens = in + out).
- No data → `—`. Never a fake price for an unfinished run: the Timeline renders no badge for a run that is
  not `done`; the PR list sums only `done` runs and the Review runs header only references finished runs (a
  review exists only for a `done` run); the trace sidebar keeps its `COST` tile and shows `—` for failed /
  cancelled runs.

### Screens

1. **Pull Requests** — new `COST` column between `STATUS` and `UPDATED`: the PR total (sum of all finished runs);
   `—` when the PR has no finished run with a known cost.
2. **PR → Agent runs** — Timeline: a second line under the launch time (`detailed`); Review runs: `compact` badge before the date in the accordion header.
3. **Agent run sidebar (Trace → Stats)** — a fourth tile `COST` between `TOKENS` and `FINDINGS`.

## Decisions

- **PR list cost = sum over the PR, not the latest run** (2026-11-22, review feedback). The first version showed the
  cost of the run behind the latest review, so after re-runs or "Run all enabled agents" the column disagreed with
  the Timeline. Now it is the sum of every `done` run with a known cost — the same runs whose badges the Timeline
  shows — so the column answers "what did reviewing this PR cost". The score stays the latest review's: a score
  is a state, cost is spend.
  - Runs with an unknown price (`cost_usd NULL`) are skipped, not treated as `0`; if none has a price → `null` (`—`).
    With a mix, the total covers only the priced runs.
  - Failed / cancelled runs are excluded by status (and never carry a cost anyway).
  - Deleting a run from the Timeline removes it from the total too (computed on read, no denormalised column).

## Out of scope

- The cost line in the Overview verdict banner (the Overview tab has no PR brief / verdict yet).
- Cost of partially executed (failed / cancelled) runs — the engine returns no partial usage on error.
- Aggregates beyond the per-PR total on the list (per agent, per repo, Agent Performance).
- Reconciliation with a provider dashboard.

## Done when

- Every `done` run shows the badge on all three screens.
- A run without data shows `—`, never `$0.00`; an unfinished run shows no price.
- The number in the badge tooltip equals the `Cost:` line in the same run's Live log.
- No new LLM calls.
- The PR list cost equals the sum of the Timeline badges of the same PR.
- Tests: server integration (cost persisted and returned by the three routes; failed run → `null`; two `done`
  runs on one PR → the list shows their sum, a failed run is not counted),
  contract back-compat (trace without `stats.cost_usd` parses), client unit tests for the format table and the three screens.
