# onion-architecture — provenance & sources

A local skill, not pulled from a registry (it is not in `skills-lock.json`). It encodes the onion / ports-and-adapters layering that the DevDigest backend already follows, and ships a `dependency-cruiser` gate to check it. Version and changelog: [SKILL.md](SKILL.md#changelog).

- **Scope:** `server/` (Fastify + Drizzle + Postgres) and `reviewer-core/` (pure review core).
- **Out of scope:** `client/` → `frontend-architecture`. Fastify mechanics → `fastify-best-practices`. Drizzle syntax → `drizzle-orm-patterns`.
- **Origin:** v1.0.0 by the course lecturer (Lesson 02, Lab 02). v1.1.0 was checked line by line against this repo on 2026-11-26.

## Files

- `SKILL.md` — the rule, the ring table, the placement order, the gate command. Kept short.
- `layer-map.md` — every ring mapped to real files with `path:line` evidence, the tool → port → adapter table, the exceptions, and the add-a-dependency recipe.
- `enforcement.md` — how to run the gate, the measured baseline, the drift and exception ledger with clean fixes, and how the patterns work.
- `depcruise.config.cjs` — the gate itself, runnable from `server/` without changing the server.

## Grounded in

`server/AGENTS.md`, `reviewer-core/AGENTS.md`, `server/src/platform/container.ts`, `server/src/vendor/shared/adapters.ts`, `server/src/adapters/**`, `server/src/modules/**`, `server/src/modules/repo-intel/README.md`, `reviewer-core/src/**`, `server/tsconfig.json`, `server/package.json`.

## Validation (2026-11-26)

- Lecturer's v1.0.0 config on today's code: `0 errors, 14 warnings` (127 modules, 377 deps). It claimed 15. The `pulls/routes → reviews/helpers` edge no longer exists: `server/src/modules/pulls/routes.ts:1-10` has no reviews import.
- Its package rules never fire on the real tree. `exclude: node_modules` removes package edges, and anchored `^fastify`/`^postgres`/`^drizzle-orm`/`^node:fs` don't match resolved paths. Proof: 5 module files import `drizzle-orm` outside a repository, and it reported none of them.
- Probe (a throwaway `reviewer-core/src/bad.ts` importing `fastify`, `node:fs`, `drizzle-orm`, `openai`, plus `llm/ok.ts` importing `openai` and `node:fs/promises`): v1.1.0 reported 5 errors out of 5 expected. v1.0.0 reported 2, missing `node:fs` and `openai` even with bare unresolved names.
- v1.1.0 config on today's code: `0 errors, 20 warnings` (147 modules, 454 deps).

## Reading list

### Onion / Clean architecture
- Jeffrey Palermo — The Onion Architecture, part 1 — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- Jeffrey Palermo — onion-architecture tag (parts 2–4) — https://jeffreypalermo.com/tag/onion-architecture/
- Herberto Graça — Onion Architecture (Software Architecture Chronicles) — https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85
- Robert C. Martin — The Clean Architecture — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Original Palermo example (repo) — https://github.com/Jordiag/Jeffrey-Palermo-Onion-Architecture

### Ports & adapters in Node.js / TypeScript
- Domain-Driven Hexagon (Sairyss) — https://dev.to/sairyss/domain-driven-hexagon-18g5
- Khalil Stemmler — Clean Node.js Architecture — https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/
- Hexagonal & Clean Architecture with examples (dyarleniber) — https://dev.to/dyarleniber/hexagonal-architecture-and-clean-architecture-with-examples-48oi
- Ports and Adapters explained with two real codebases (Saad Hasan) — https://saadh393.github.io/blog/adapter-port-architecture-two-cases
- Future-Proof Your Code: Ports & Adapters (Alex Rusin) — https://blog.alexrusin.com/future-proof-your-code-a-guide-to-ports-adapters-hexagonal-architecture/
- tsh.io — Hexagonal architecture overview — https://tsh.io/blog/hexagonal-architecture

### dependency-cruiser
- dependency-cruiser — npm — https://www.npmjs.com/package/dependency-cruiser
- Rules reference (`from`/`to`, `path`/`pathNot`, `$1` group matching) — https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
- Validate Dependencies According to Clean Architecture (Ken Miyashita) — https://betterprogramming.pub/validate-dependencies-according-to-clean-architecture-743077ea084c
- Avoid Cross Module Dependencies with Dependency Cruiser — https://dev.to/jacobandrewsky/avoid-cross-module-dependencies-with-dependency-cruiser-3b0b
- Dependency Cruiser: Restrict Imports in JavaScript (Atomic Object) — https://spin.atomicobject.com/dependency-cruiser-imports/
- cubic — maintain clean architecture with dependency rules — https://www.cubic.dev/blog/how-to-maintain-clean-architecture-with-dependency-rules-in-your-codebase

### Fastify (layering / encapsulation)
- Fastify — Plugins Guide — https://fastify.dev/docs/latest/Guides/Plugins-Guide/
- Fastify — Encapsulation — https://fastify.dev/docs/latest/Reference/Encapsulation/
- node-fastify-architecture (modular structure) — https://github.com/sujeet-agrahari/node-fastify-architecture

### Repository pattern
- Atomic Repositories in Clean Architecture and TypeScript (Sentry) — https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/
- cosmicpython — Repository Pattern — https://www.cosmicpython.com/book/chapter_02_repository
- Microsoft Learn — infrastructure persistence layer design — https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design
- Repository Pattern in Nest.js with Drizzle ORM — https://medium.com/@vimulatus/repository-pattern-in-nest-js-with-drizzle-orm-e848aa75ecae
