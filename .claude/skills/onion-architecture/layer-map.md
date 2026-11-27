# Layer map — DevDigest backend

Each ring mapped onto real files, with evidence. Paths are relative to `server/` unless noted. `@devdigest/shared` resolves to `src/vendor/shared/`, `@devdigest/reviewer-core` to `../reviewer-core/src/` (`server/tsconfig.json` `paths`). Checked 2026-11-26.

## 1. Core — `../reviewer-core/src/**`

Eight files: `index.ts` (public API), `grounding.ts`, `prompt.ts`, `review/{run,reduce}.ts`, `output/to-review.ts`, `llm/{openrouter,structured}.ts`. Its invariants live in `reviewer-core/AGENTS.md`; this ring adds only the import rule.

- The review pipeline gets its model through an injected `llm: LLMProvider` (`reviewer-core/src/review/run.ts:52`).
- **Exception — `llm/`:** `OpenRouterProvider` is a concrete `LLMProvider` that lives in core and uses the `openai` SDK (`reviewer-core/src/llm/openrouter.ts:1`, `:39`; `llm/structured.ts:2`). The server builds it in the composition root (`src/platform/container.ts:22`, `:207`). The gate lets `llm/` import `openai` and nothing else with I/O.
- The only server import is `@devdigest/shared` (verified with depcruise).

## 2. Ports — `src/vendor/shared/**`

- Shared ports in `src/vendor/shared/adapters.ts`: `LLMProvider` (`:82`), `Embedder` (`:91`), `Tokenizer` (`:103`), `ArchiveReader` (`:124`), `GitHubClient` (`:180`), `GitClient` (`:242`), `CodeIndex` (`:287`), `AuthProvider` (`:305`), `SecretsProvider` (`:318`). Contracts/DTOs are in `contracts/*`.
- Name what the app needs, not the vendor: `GitHubClient`, not `Octokit`.
- Imports only `zod` today; the gate's `ports-are-abstract` rule keeps it that way.
- `Tokenizer` (`adapters.ts:103`) moved here on 2026-11-26: besides repo-intel, the review run executor counts skills tokens with it (`container.tokenizer`); `adapters/tokenizer/index.ts` implements and re-exports it.
- **Internal port, not in shared:** `DepGraph` (`src/adapters/depgraph/index.ts:27`) is declared next to its adapter and used only by repo-intel (`depgraph/index.ts:8`). `RepoIntel` is the facade interface (`src/modules/repo-intel/types.ts:137`). A new port that features use belongs in `adapters.ts`.

## 3. Application — services

- Services exist in `agents`, `conventions`, `repo-intel`, `repos`, `reviews`, `skills`. Most take the whole `Container` (`src/modules/agents/service.ts:54`, `repos/service.ts:32`, `reviews/service.ts:33`, `repo-intel/service.ts:104`). Routes build them: `new AgentsService(app.container)` (`src/modules/agents/routes.ts:72`).
- **A service another module needs lives on the container** and takes a structural deps type instead of importing `Container`, so the root can build it without a new cycle: `container.skills` (`container.ts:122`, `SkillsDeps = { db, archive }` in `skills/service.ts`) and `container.featureModel(ws, id)` (`container.ts:130`, `FeatureModelDeps = { db }` in `settings/feature-models.ts`). The conventions extractor (`server/specs/003-conventions.md`) uses both and imports nothing from `modules/skills` or `modules/settings`.
- `polling`, `pulls`, `settings`, `workspace` have no service: their routes read `container.*` and `db/schema` directly (drift, see [enforcement.md](enforcement.md)).
- Reach adapters through the container: `container.git` (`container.ts:89`), `container.codeIndex` (`:105`), `await container.github()` (`:155`), `await container.llm('openai' | 'anthropic' | 'openrouter')` (`:165`), `await container.embedder()` (`:217`).
- **Exception — repo-intel:** it is the indexer infrastructure behind the `container.repoIntel` facade (`src/modules/repo-intel/README.md:33-35`, `container.ts:116`). Its service and pipeline import adapters directly: `service.ts:22,28`, `pipeline/full.ts:28-29`, `pipeline/incremental.ts:22-23`, `pipeline/repo-map.ts:12`.

## 4. Infrastructure

### 4a. Adapters — `src/adapters/<kind>/`

| Tool / SDK | Port | Adapter |
|------------|------|---------|
| `openai`, `@anthropic-ai/sdk` | `LLMProvider` | `adapters/llm/{openai,anthropic}.ts` (+ core `OpenRouterProvider`) |
| `octokit` | `GitHubClient` | `adapters/github/octokit.ts` |
| `simple-git` | `GitClient` | `adapters/git/simple-git.ts` |
| `@vscode/ripgrep` | `CodeIndex` | `adapters/codeindex/ripgrep.ts` |
| OpenAI embeddings | `Embedder` | `adapters/embedder/openai.ts` |
| `~/.devdigest/secrets.json` | `SecretsProvider` | `adapters/secrets/local.ts` |
| local single user | `AuthProvider` | `adapters/auth/local.ts` |
| `@ast-grep/napi` | — (repo-intel only) | `adapters/astgrep/index.ts` |
| `js-tiktoken` | `Tokenizer` | `adapters/tokenizer/index.ts` |
| `fflate` | `ArchiveReader` | `adapters/archive/fflate.ts` (skill import, in memory only) |
| `dependency-cruiser` | `DepGraph` (internal) | `adapters/depgraph/index.ts` |

Not wrappers: `adapters/git/diff-parser.ts` is a pure parser (imports only shared types, `:1`), and `adapters/llm/pricing.ts` is a static price table.

- An adapter must not import a module. **Exception:** `adapters/astgrep/index.ts:25` and `adapters/depgraph/index.ts:20` import `modules/repo-intel/constants.ts` (`SUPPORTED_EXT`, `MAX_SIGNATURE_CHARS`).

### 4b. Persistence — `src/db/**` + repositories

- Repositories: `agents/repository.ts`, `repos/repository.ts`, `repo-intel/repository.ts`, `reviews/repository.ts` + `reviews/repository/{pull,review,run}.repo.ts`. They return row types from `src/db/rows.ts` or DTOs (e.g. `agents/repository.ts:14`), never a query builder.
- Infrastructure outside modules may touch the schema too: `adapters/auth/local.ts:4`, `platform/jobs.ts:4`.
- Schema and migration workflow: `server/AGENTS.md` (not repeated here).

## 5. Composition root — `src/platform/container.ts`

- Lazily builds adapters, with secrets resolved through `SecretsProvider`. Tests swap any of them through `ContainerOverrides` (`:40`), including `repoIntel`, `depgraph` and `tokenizer`.
- It also builds repositories and the repo-intel facade (`:26`, `:29`, `:97`, `:118`). Importing `RepoIntelService` is what creates the 4 container cycles the gate reports.
- Other cross-cutting code in `src/platform/` (config, errors, SSE, jobs, grounding, price-book, resilience, …) is not a feature: modules may import it.

## 6. Transport — `src/modules/<m>/routes.ts`

- Calls its service or `container.*`, plus `modules/_shared/` (`context.ts`, `schemas.ts`). Never an adapter (gate rule `routes-are-thin`).
- Route and plugin conventions: `server/AGENTS.md` and `fastify-best-practices`.

## Adding an external dependency

1. **Port** — an interface in `src/vendor/shared/adapters.ts` named for the need, with no vendor in its shape.
2. **Adapter** — `src/adapters/<kind>/<impl>.ts` wraps the SDK and implements the port.
3. **Mock** — add a class to `src/adapters/mocks.ts` (it mocks 8 of the 9 shared ports, `MockArchiveReader` last; `Tokenizer` needs none — tests pass a counter via `ContainerOverrides.tokenizer` or use the real one).
4. **Wire** — a lazy getter in `container.ts` (async if it needs a secret), plus a field in `ContainerOverrides`.
5. **Consume** — services call `container.<port>`; they never import the SDK or the adapter.
6. **Gate** — add the SDK to `SDKS` in `depcruise.config.cjs`, so core and ports stay unable to import it.
