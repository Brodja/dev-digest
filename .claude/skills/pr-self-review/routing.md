# Routing — scope, surfaces, skills

`scripts/scope.mjs` applies these rules mechanically (`scripts/lib.mjs`: `surfaceOf`, `tagsOf`, `skillsOf`). This file is the human-readable contract. If you change one, change the other.

## 1. Scope

- `BASE = git merge-base <ref> HEAD`, where `<ref>` is the argument, else `origin/main`, else `main`.
- Changes = `git diff -M -C <BASE>` (committed-not-merged + staged + unstaged) plus `git ls-files --others --exclude-standard` (untracked).
- `-C` treats a file that was moved and replaced by a stub as a copy, so only its really changed lines count (e.g. `CLAUDE.md` → `AGENTS.md`).
- **Added lines** come from `git diff -U0` hunks (an untracked file counts as all added). Findings must cite an added line.

## 2. Surfaces and skills

| Surface | Files | Skills |
|---------|-------|--------|
| **client** | `client/**` except `*.md` | `frontend-architecture`, `react-best-practices`, `react-testing-library`; plus `next-best-practices` for `client/src/app/**` |
| **backend** | `server/**`, `reviewer-core/**` except `*.md` | `onion-architecture` (with its depcruise gate), `fastify-best-practices`, `drizzle-orm-patterns` |
| **e2e** | `e2e/**` except `*.md` | general check only; deterministic: `npm run typecheck` |
| **rest** | `*.md` anywhere, `.claude/**`, root files | general check only |

Extra skills by file:

- `security` — any `.ts` / `.tsx`.
- `zod` — files under `*/src/vendor/shared/**` (contracts) and `server/src/modules/*/routes.ts` (route schemas).
- `postgresql-table-design` — `server/src/db/schema.ts` and `server/src/db/schema/**` only.

On a large surface, apply each skill where it bites. `fastify-best-practices` covers routes and plugins, `drizzle-orm-patterns` covers repositories and schema, `react-testing-library` covers tests and testability of changed components.

## 3. Deterministic checks per package

A package is checked when one of its non-`.md` files changed. A `reviewer-core` change also triggers the server typecheck (root `AGENTS.md`).

| Package | Commands (from repo root) |
|---------|---------------------------|
| reviewer-core | `cd reviewer-core && npm run typecheck` · `npm test` |
| server | `cd server && pnpm typecheck` · `pnpm exec vitest run --exclude '**/*.it.test.ts'` (unit only, no Docker) |
| client | `cd client && pnpm typecheck` · `pnpm test` |
| e2e | `cd e2e && npm run typecheck` |
| backend changed | `node .claude/skills/pr-self-review/scripts/depcruise-changed.mjs [base-ref]` |

## 4. Tags and hard flags

| Tag | Path | Effect |
|-----|------|--------|
| `migration-edit` | modified or deleted `server/src/db/migrations/**` | CRITICAL (a new generated migration is `migration-new`, fine) |
| `wrong-lockfile` | `package-lock.json` in client/server, `pnpm-lock.yaml` in reviewer-core/e2e | CRITICAL |
| `secret-file` | `.env*` (not `.example`), `secrets.json` | CRITICAL |
| `template-skill` | files of the template skills in `.claude/skills/` | WARNING (do-not-touch) |
| `generated` | `.next/`, `dist/`, `node_modules/` | WARNING |
| `contract` | `*/src/vendor/shared/**` | + `zod`, contract-mirror check (severity.md §3) |
| `route` | `server/src/modules/*/routes.ts` | + `zod` |
| `db-schema` | `server/src/db/schema*` | + `postgresql-table-design` |
| `app-router` | `client/src/app/**` | + `next-best-practices` |
| `test` / `it-test` | `*.test.ts(x)` / `*.it.test.ts` | tests are reviewed for correctness, not style |
| `skill` | `.claude/skills/*/SKILL.md` | frontmatter check (severity.md §4) |
