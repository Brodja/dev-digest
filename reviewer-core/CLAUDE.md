# reviewer-core — `@devdigest/reviewer-core`

Pure review engine: diff → prompt → LLM → grounded findings. Its only consumer today is `server/`.

Read first: [INSIGHTS.md](INSIGHTS.md). More: [README.md](README.md) (pipeline, public API) · [docs/](docs/README.md) ·
[specs/](specs/README.md) · [prompt conventions](../docs/agent-prompts/README.md)

## Invariants — keep them

- No DB, GitHub, filesystem, or `process.env`. The only side effect is an LLM call through the injected `LLMProvider`.
- Every untrusted input (diff, PR body, repo-derived context) goes through `wrapUntrusted`; `INJECTION_GUARD` stays appended to the system prompt.
- Grounding is mandatory: a finding whose lines don't intersect a diff hunk is dropped.
- Score = `scoreFromFindings(grounded findings)`; never trust the model's own score.

## How it's consumed

- The server imports TS source via the `@devdigest/reviewer-core` alias; the public API is `src/index.ts` only.
- After changing exports or signatures, also run the server typecheck (`cd ../server && pnpm typecheck`).
- Contracts come from `../server/src/vendor/shared` through the alias — there is no local copy.

## Commands

- npm, not pnpm. `npm run build` is only a typecheck — this package emits no JS.
- Tests stub the LLM: no keys, no network.
