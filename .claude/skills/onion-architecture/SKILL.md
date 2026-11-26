---
name: onion-architecture
description: "ALWAYS use when adding, moving or reviewing backend code in DevDigest server/ or reviewer-core/: placing a route, service, repository, adapter or port, deciding where a DB query or an external SDK call (LLM, GitHub, git, ripgrep, ast-grep) may live, wiring platform/container.ts, or letting one module use another. It enforces the inward-only dependency rule with a dependency-cruiser gate that you run before finishing. Do not add a module, adapter, port or cross-module import, and do not touch db/schema or drizzle-orm outside a repository, without this skill. Not for Fastify API mechanics (fastify-best-practices), Drizzle query or schema syntax (drizzle-orm-patterns) or client/ (frontend-architecture)."
version: "1.1.0"
---

# Onion architecture — DevDigest backend

The backend is already a ports-and-adapters design. This skill maps the rings onto our files and checks them with a dependency-cruiser gate. Provenance and sources: [README.md](README.md).

## The rule

**Imports point inward.** A file may import a more central ring, never an outer one. Inner rings declare interfaces (ports), outer rings implement them, and the composition root `src/platform/container.ts` binds the two. It is the only file allowed to know a port and its concrete class at once.

Rings, centre first: **core** `reviewer-core/src` → **ports** `@devdigest/shared` → **application** services → **infrastructure** adapters + repositories → **transport** routes.

| Ring | Where (paths from `server/`) | Must NOT import |
|------|------------------------------|-----------------|
| Core | `../reviewer-core/src/**` | DB, `fs`, sockets, server code, SDKs. Only `llm/` may use `openai` |
| Ports | `src/vendor/shared/**` | anything but `zod` |
| Application | `src/modules/<m>/service.ts`, `reviews/run-executor.ts` | `src/adapters/**` (use `container.*`) |
| Infrastructure | `src/adapters/**`, `src/db/**`, `src/modules/<m>/repository*` | `src/modules/**` (a feature) |
| Transport | `src/modules/<m>/routes.ts` | `src/adapters/**` |
| Composition root | `src/platform/container.ts` | — (binds everything) |

Per-ring detail, with the real files and the exceptions: [layer-map.md](layer-map.md).

## Placing a change — in this order

1. **External call** (HTTP, LLM, GitHub, git, ripgrep, ast-grep)? Put a port in `src/vendor/shared/adapters.ts` and its implementation in `src/adapters/<kind>/`. Consume it through `container.*`, never from a service or route.
2. **DB query?** Put it in `src/modules/<m>/repository.ts` (or `repository/*.repo.ts`). Only repositories import `db/schema` and `drizzle-orm`.
3. **Orchestration** ("when a review runs, do X then Y")? Put it in the module's `service.ts`; heavy run logic goes in `reviews/run-executor.ts`.
4. **HTTP wiring?** Put it in `routes.ts`: call the service or `container.*`, no queries, no adapters. A module that only has routes gets a service and repository before it gets new queries.
5. **Pure review logic** (diff → prompt → grounded findings → score)? Put it in `reviewer-core`; it reaches the LLM only through the injected `LLMProvider`.
6. **Module A needs module B?** Go through `container.*` (`container.repoIntel`, `container.agentsRepo`, …) or `modules/_shared/`, never through B's files.

New external dependency, step by step: [layer-map.md#adding-an-external-dependency](layer-map.md#adding-an-external-dependency).

## Before finishing — run the gate

```bash
cd server
pnpm exec depcruise src ../reviewer-core/src --config ../.claude/skills/onion-architecture/depcruise.config.cjs
```

Baseline (2026-11-26): **0 errors, 20 warnings**. Any `error` fails the run and must be fixed. A `warn` is known drift: don't add new ones, and don't "fix" them silently in an unrelated change. Rules, drift list and exceptions: [enforcement.md](enforcement.md).

## Changelog

- **1.1.0** (2026-11-26) — Checked against the code. Fixed the gate: package rules never fired (node_modules was excluded, `^fastify`/`^node:fs` never match resolved paths). Added `ports-are-abstract`, `core-llm-only-openai` and `module-helpers-avoid-adapters`. Re-measured the baseline. Corrected the ports, exceptions and drift lists. Switched commands to pnpm. Dropped what server/AGENTS.md already says.
- **1.0.0** (2026-06-18) — Lecturer's original (Lesson 02, Lab 02).
