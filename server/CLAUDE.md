# server — `@devdigest/api`

Fastify 5 API over Drizzle/Postgres. Owns all I/O: GitHub, git clones, LLM calls, DB, SSE.

Read first: [INSIGHTS.md](INSIGHTS.md). More: [README.md](README.md) (API map, env vars, review context) ·
[docs/](docs/README.md) · [specs/](specs/README.md) · [repo-intel](src/modules/repo-intel/README.md) ·
[agent prompts](../docs/agent-prompts/README.md)

## Map

- `src/modules/<name>/` — one feature each: `routes.ts` (Fastify plugin) → `service.ts` → `repository.ts`; pure code in `helpers.ts` / `constants.ts`.
- `src/platform/` — DI container (`container.ts`), errors, config, RunBus/SSE (`sse.ts`), run logger.
- `src/adapters/` — ports to the outside world (LLM, GitHub, git, ast-grep, …); test doubles in `mocks.ts`.
- `src/db/` — `schema/*.ts` (barrel `schema.ts`), `migrations/`, `seed.ts`, `seed-prompts.ts`.
- `src/vendor/shared/` — `@devdigest/shared` Zod contracts, canonical copy.
- `test/` — tests; `test/helpers/pg.ts` starts a real Postgres via testcontainers.

## Commands (beyond the root table)

- Unit only, no Docker: `pnpm exec vitest run --exclude '**/*.it.test.ts'`
- Integration only (Docker): `pnpm exec vitest run .it.test`
- Schema change: edit `src/db/schema/*.ts` → `pnpm db:generate` → `pnpm db:migrate`. Migrations are NOT applied on boot.
- `pnpm db:seed` — idempotent demo data.

## Conventions

- New module: default-export plugin in `modules/<name>/routes.ts` + one entry in `src/modules/index.ts` (no autoload).
- Validate params/body with Zod in the route's `schema` (fastify-type-provider-zod), not `Schema.parse(req.body)` in the handler.
- Throw `AppError` / `NotFoundError` from `platform/errors.ts`; the shared handler shapes the response.
- External I/O only through adapters on `container` — that is what keeps unit tests hermetic.
- Relative imports keep the `.js` suffix (`'./service.js'`).
- A test that imports `test/helpers/pg.ts` must be named `*.it.test.ts`.

## Do not touch

- `src/db/migrations/**` — never edit applied SQL or the `meta/` snapshots/journal; generate a new migration.
- Tables that look unused — the schema already holds tables for later milestones.
- Seed data (`acme/payments-api`, PR #482, the built-in agents) — e2e flows and integration tests depend on it.
- `clones/` — runtime data.

## Gotchas

- Changing a contract in `src/vendor/shared`: mirror it into `client/src/vendor/shared` if the client uses it (the copies already differ).
- `seed-prompts.ts` mirrors `../docs/agent-prompts/*.md` — edit both. At run time the DB row is the source of truth.
- Use the root `docker-compose.yml` (what `dev.sh` uses), not `server/docker-compose.yml`: same container name, but this one binds all interfaces.
