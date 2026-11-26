# Enforcement — the dependency-cruiser gate

The gate turns the dependency rule into a failing command. `dependency-cruiser` is already a `server/` dependency (`server/package.json:25`, used by `adapters/depgraph`), so there is nothing to install. The config ships with this skill: [depcruise.config.cjs](depcruise.config.cjs) (CommonJS on purpose, because `server/package.json:6` is `"type": "module"`).

## Run

```bash
cd server
pnpm exec depcruise src ../reviewer-core/src --config ../.claude/skills/onion-architecture/depcruise.config.cjs
# readable report: add --output-type err-long
```

It exits non-zero only on an `error`. To make it a project script, copy the config to `server/.dependency-cruiser.cjs`, add `"depcruise": "depcruise src ../reviewer-core/src --config .dependency-cruiser.cjs"` to `server/package.json`, and wire it into CI. That is a server change, so it gets its own commit.

## Baseline — 2026-11-26 (Windows 11, Node 20.20.2, dependency-cruiser 17.4.3)

`x 20 dependency violations (0 errors, 20 warnings). 147 modules, 454 dependencies cruised.` (~1.3 s)

| Rule | Severity | Today | Clean fix |
|------|----------|-------|-----------|
| `core-is-pure` | error | 0 | — |
| `core-llm-only-openai` | error | 0 | — |
| `ports-are-abstract` | error | 0 | — |
| `services-depend-on-ports` | error | 0 | — |
| `routes-are-thin` | error | 0 | — |
| `adapters-dont-know-modules` | error | 0 (1 encoded exception) | move `SUPPORTED_EXT` / `MAX_SIGNATURE_CHARS` out of `modules/repo-intel/constants.ts`, then drop the `pathNot` |
| `db-confined-to-repositories` | warn | 13 edges in 8 files: routes of `polling`/`pulls`/`settings`/`workspace`, `reviews/run-executor`, `reviews/diff-loader`, `repos/helpers`, `settings/feature-models` | move each query into a repository; the 4 routes-only modules need a service + repository first |
| `no-circular` | warn | 5: four via `container.ts` → `repo-intel/service.ts` (+ `pipeline/full`, `pipeline/incremental`) → `Container` type; one `agents/helpers.ts:3` ↔ `agents/repository.ts:6` | agents: import `AgentRow`/`AgentVersionRow` in `helpers.ts` from `db/rows.ts`, not `./repository.js`. Container: decide a policy (inject only the needed ports, or exempt the root) |
| `no-cross-module-internals` | warn | 1: `repos/service.ts:7-10` → `repo-intel/constants.ts` | go through `container.repoIntel`, or move the shared constant to `platform/` |
| `module-helpers-avoid-adapters` | warn | 1: `reviews/diff-loader.ts:3` → `adapters/git/diff-parser.ts` | move the pure `parseUnifiedDiff` out of `adapters/` (to `platform/` or `reviewer-core`) |

**Ratchet.** When a warn backlog reaches zero, promote that rule to `error` in the same change. When you remove an exception in code, delete its `pathNot` in the same change too. A lenient rule that outlives its cause quietly reopens the boundary.

## How the patterns work (read before editing rules)

- Rules match **resolved** paths: `src/modules/...`, `../reviewer-core/src/...`, `node_modules/drizzle-orm/index.cjs`, a bare `octokit` (its ESM exports map doesn't resolve), and `fs` for core modules (`node:fs` imports resolve to `fs`).
- So match packages with `(^|node_modules/)name(/|$)` (the `pkg()` helper) and Node I/O with `^(node:)?fs(/|$)`. Never use `^fastify` or `^node:fs`: they match nothing.
- Keep `node_modules` in `doNotFollow` only. Putting it in `exclude` drops every edge to a package, and the package rules go silent.
- `$1` in `to.path`/`to.pathNot` refers to the capture group in `from.path` (used by `no-cross-module-internals`).
- After editing, prove a rule fires: point the gate at a throwaway file that breaks it (see README "Validation"). A green run alone proves nothing.
