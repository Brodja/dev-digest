# reviewer-core — insights

Entry format: `YYYY-MM-DD · category · insight · file:line`

- 2026-11-21 · oddity · reviewPullRequest sums costUsd per chunk but turns the WHOLE run's cost into null as soon as one chunk returns costUsd=null (model missing from the price table) — the partial sum is lost, agent_runs.cost_usd stays NULL and the run-cost badge shows '—'; add the model to PRICING instead of expecting a partial cost · reviewer-core/src/review/run.ts:184, server/src/adapters/llm/pricing.ts:42-46
- 2026-11-26 · oddity · assemblePrompt joins PromptParts.skills verbatim into '## Skills / rules' without wrapUntrusted, although the file header calls community skills untrusted data, so an imported skill passed as a string reaches the model as trusted instructions; wrap untrusted skills (plan: SkillBlock + renderSkillBlock in server/specs/002-skills.md) before feeding imported content · reviewer-core/src/prompt.ts:5-8, reviewer-core/src/prompt.ts:42-43, reviewer-core/src/prompt.ts:88-89, reviewer-core/src/prompt.ts:109
