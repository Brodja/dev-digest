# DevDigest

Local-first AI pull-request review — a course starter template; milestones M1–M8 are in [README.md](README.md#roadmap).
Flow: add repo → clone + index → import PRs → run agent review → grounded findings in the UI.

## Stack & layout

Four **independent** packages — not a workspace: each has its own lockfile and `node_modules`.

| Dir | Package | Stack | PM | Port |
|-----|---------|-------|----|------|
| `client/` | `@devdigest/web` | Next.js 15 (App Router), React 19, TanStack Query, next-intl | pnpm | 3000 |
| `server/` | `@devdigest/api` | Fastify 5, Drizzle ORM, Postgres 16 + pgvector (Docker) | pnpm | 3001 |
| `reviewer-core/` | `@devdigest/reviewer-core` | pure review engine: diff → prompt → LLM → findings | npm | — |
| `e2e/` | `@devdigest/e2e` | Vercel agent-browser flows (**not Playwright**) | npm | — |

Shared: TypeScript 5.9 (`strict` + `noUncheckedIndexedAccess`), Zod 3, Vitest 2, pnpm 10. CI runs on Node 22.

Packages share code only through tsconfig path aliases, as TS source (no build step):
- `@devdigest/shared` (Zod contracts) → `server/src/vendor/shared` — canonical; `client/src/vendor/shared` is a copy that lags behind.
- `@devdigest/reviewer-core` → `reviewer-core/src`.

## Commands

Whole stack (Postgres + migrate + seed + API + web): `./scripts/dev.sh` — flags `--no-seed`, `--no-client`, `--db-only`.
Postgres only: `docker compose up -d` from the repo root.

| Package | dev | test | typecheck |
|---------|-----|------|-----------|
| client | `pnpm dev` | `pnpm test` | `pnpm typecheck` |
| server | `pnpm dev` | `pnpm test` (`*.it.test.ts` need Docker) | `pnpm typecheck` |
| reviewer-core | — | `npm test` | `npm run typecheck` |
| e2e | — | `npm run e2e:hermetic` | `npm run typecheck` |

- Server typecheck compiles `reviewer-core/src`, so it needs `reviewer-core/node_modules` (`npm ci` there first).
- Before finishing: run test + typecheck for every package you changed (a `reviewer-core` change → check the server too), then run `/engineering-insights`.

## Naming

- Server files kebab-case (`run-executor.ts`); client component folders PascalCase (`FindingCard/`).
- Tests sit next to the code: `*.test.ts(x)`. Tests that need a real Postgres: `*.it.test.ts`.
- A Zod schema and its type share one name: `export const Finding = z.object(…)` + `export type Finding = z.infer<typeof Finding>`.
- API JSON is snake_case (`head_sha`); TS and Drizzle fields are camelCase (`headSha`).

## Do not touch

- Lockfiles (`pnpm-lock.yaml`, `package-lock.json`) — change only via that package's own manager; never npm in client/server, never pnpm in reviewer-core/e2e.
- `server/src/db/migrations/**` — generated and already applied; see `server/AGENTS.md`.
- `.env`, `.env.local`, `~/.devdigest/secrets.json` — secrets: don't read, print, or commit.
- `server/clones/` — runtime checkouts of imported repos (git-ignored; includes a copy of this repo — not our source).
- Generated output: `client/.next/`, `dist/`, `node_modules/`.
- Skills that came with the template — everything in `.claude/skills/` as of now (`drizzle-orm-patterns`, `fastify-best-practices`, `mermaid-diagram`, `next-best-practices`, `postgresql-table-design`, `react-best-practices`, `react-testing-library`, `security`, `typescript-expert`, `zod`; some are pinned in `skills-lock.json`) — don't edit, update only from their source. Our own skills (e.g. `engineering-insights`) live in `.claude/skills/` too and are editable.
- `docker compose down -v` — deletes the `devdigest_pgdata` volume with every imported repo and review.

## Docs

- [README.md](README.md) — architecture, quick start, roadmap · [TESTING.md](TESTING.md) — test strategy, CI map.
- [docs/agent-prompts/](docs/agent-prompts/README.md) — reviewer agent prompts and their conventions.
- Every package has `AGENTS.md` (its `CLAUDE.md` is a one-line `@AGENTS.md` import, so it loads when you work there; edit `AGENTS.md`), `README.md`, `docs/`, `INSIGHTS.md`; client, server and reviewer-core also have `specs/`.
- Before working in a package, read its `INSIGHTS.md`.
