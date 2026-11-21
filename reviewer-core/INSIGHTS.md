# reviewer-core — insights

Entry format: `YYYY-MM-DD · category · insight · file:line`

- 2026-11-21 · oddity · reviewPullRequest sums costUsd per chunk but turns the WHOLE run's cost into null as soon as one chunk returns costUsd=null (model missing from the price table) — the partial sum is lost, agent_runs.cost_usd stays NULL and the run-cost badge shows '—'; add the model to PRICING instead of expecting a partial cost · reviewer-core/src/review/run.ts:184, server/src/adapters/llm/pricing.ts:42-46
