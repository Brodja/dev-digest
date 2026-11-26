# Skills control experiment (lab L02, B4b)

Does linking skills change what a reviewer agent finds? Each agent reviewed its demo PR
twice **without** skills (links switched off for the run) and twice **with** skills.
Two runs per cell because the model is not deterministic — the numbers are indicative,
not statistically significant.

## Setup

| | |
|---|---|
| Date | 2026-11-26, local stack (Windows 11) |
| Model | openrouter / `deepseek/deepseek-v4-flash`, single-pass, repo intel on (repo skeleton ≈ 1 500 tokens) |
| Test Quality Reviewer | PR #8 `demo/happy-path-test` (`58a82be`): new `parsePageParams` with error branches and edge cases, one happy-path test |
| API Contract Reviewer | PR #9 `demo/api-contract-change` (`d9a912e`): `RunSummary.ran_at` → `started_at` (server contract + mapper only), `GET /agents/:id/models` removed |
| Skills (Test Quality) | uncovered-branches, missing-edge-cases, over-mocking, flaky-tests — block **655 tokens** |
| Skills (API Contract) | breaking-change, response-schema, semver-discipline, deprecation-policy (**imported, untrusted**) — block **702 tokens** |
| Runs | 8, sequential, same diff; links restored to enabled afterwards |

What counts as the key issues:

- **PR #8** — the untested error branches (422 for invalid `page` / `limit`) and edge cases
  (defaults, the cap at 100, `page = 1` → `offset = 0`; also `""` → 0 → 422).
- **PR #9** — the renamed response field, the removed route, the client copy of the contract
  left unchanged (drift), no deprecation, no version bump.

## Results — Test Quality Reviewer on PR #8

| Run | Skills | Findings C / W / S | Error branches (422) | Defaults | Cap > 100 | `page = 1` → offset 0 | `""` | Tokens in → out | Skills block | Cost, USD |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | — | 3 / 2 / 0 | ✅ | ✅ (CRITICAL) | ✅ | ✅ | ❌ | 3 754 → 1 279 | — | 0.000520 |
| 2 | — | 2 / 2 / 0 | ✅ | ✅ | ✅ | ✅ | ❌ | 3 754 → 912 | — | 0.000261 |
| 3 | ✅ | 2 / 2 / 0 | ✅ | ✅ | ✅ | ✅ | ❌ | 4 434 → 899 | 655 | 0.000685 |
| 4 | ✅ | 1 / 3 / 0 | ✅ | ✅ | ✅ | ✅ | ❌ | 4 434 → 1 058 | 655 | 0.000294 |

All findings passed grounding (5/5, 4/4, 4/4, 4/4); every verdict was `request_changes`.

## Results — API Contract Reviewer on PR #9

| Run | Skills | Findings C / W / S | Renamed field | Removed route | Client copy drift | No deprecation | No version bump | Tokens in → out | Skills block | Cost, USD |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | — | 1 / 0 / 0 | ✅ | ❌ — "removal is safe" | ◐ "client not updated", not the contract copy | ◐ only as a fix | ❌ | 4 297 → 429 | — | 0.000466 |
| 2 | — | 2 / 0 / 0 | ✅ | ✅ | ✅ | ✅ | ✅ | 4 297 → 834 | — | 0.000264 |
| 3 | ✅ | 2 / 0 / 0 | ✅ | ✅ | ❌ | ✅ `@deprecated` + sunset date | ✅ | 5 082 → 641 | 702 | 0.000719 |
| 4 | ✅ | 2 / 0 / 0 | ✅ | ✅ | ✅ | ✅ "per the deprecation policy" | ◐ summary only | 5 082 → 736 | 702 | 0.000268 |

All findings passed grounding; every verdict was `request_changes`. Every run named the
consumers that break wrongly (`useRuns` in `lib/hooks/agents.ts`, `RunStatus`,
`RunTraceDrawer`); the real consumer, `RunHistory`, was named in none. Run 4 also claims
that the agent editor calls the removed route — it does not (it uses `/providers/:id/models`).

✅ found · ◐ partly · ❌ missed. Trace ids: PR #8 `acc2ecca`, `7eb19bc6`, `6f66bdc5`, `3b383b27`;
PR #9 `ad9001b0`, `16ecf9e6`, `9b360722`, `48214ef7` (in that order).

## Conclusion

- **The base prompts already catch the obvious issues.** On these small PRs every Test
  Quality run found the untested 422 branches and the main edge cases with or without skills;
  every API run found the rename. Nobody found the `""` case.
- **Skills made the API reviewer more complete and more consistent.** With skills the removed
  route was caught 2/2 (vs 1/2) and missing deprecation was a finding 2/2 (vs 1/2 plus a
  hint). The fixes followed the skills: `@deprecated` with a replacement and a sunset date,
  and one run cited "the deprecation policy". The imported skill was applied as a checklist
  while wrapped as untrusted, as designed. Contract-copy drift stayed at 1/2 either way.
- **Skills calmed the test reviewer's severities** (CRITICAL per run: 3, 2 without → 2, 1
  with) and brought their vocabulary ("untested branch", "boundary"). They found nothing
  new on PR #8.
- **Skills do not fix grounding outside the diff.** The model only sees the repo skeleton,
  so it guesses consumers — wrong in all 4 API runs — and keeps CRITICAL on the route removal
  without a verified consumer, against the prompt's own rule.
- **Cost.** About +700 input tokens per call (+18 %): +$0.00016–0.00025 on a cold run,
  under +$0.00004 when the prompt is cached (the second run of each pair).
- **Method caveat.** A first batch of 8 runs was discarded: DevDigest reviewed an empty diff
  and approved with 0 findings, because a new PR's files are only fetched when its page is
  opened (see `server/INSIGHTS.md`). Open the PR page before running reviews on a fresh PR.
