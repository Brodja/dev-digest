---
name: frontend-architecture
description: "ALWAYS use when creating, moving, renaming or splitting files in DevDigest client/ (Next.js 15 App Router): deciding where a component, hook, helper, constant, style or type goes, when a colocated _components piece moves to src/components, where server calls live, how to name a new folder and how to write imports. Do not add or move files under client/src, create a folder there, or split a component without this skill. Not for hook or state correctness (react-best-practices), RSC, data fetching or Next file conventions (next-best-practices), writing tests (react-testing-library), or server/ and reviewer-core/ (onion-architecture)."
version: "2.0.0"
---

# Frontend architecture — DevDigest client

This skill decides **where code lives** in `client/src` and how to split it. `client/AGENTS.md` already gives the component-folder anatomy, the API/i18n/design-system rules and the colour rules, so they are not repeated here. Provenance and sources: [README.md](README.md).

## Where does it go?

| Code | Place | Precedent |
|------|-------|-----------|
| A screen's UI; `page.tsx` stays thin | `src/app/<route>/_components/<Name>/` | `app/agents/page.tsx` (7 lines) |
| A route's component, even with one importer | flat in that route's `_components/<Name>/` | `pulls/[number]/_components/FindingCard/` (imported only by its sibling `FindingsPanel`) |
| An inner section, meaningless outside its parent | `<Parent>/_components/<Child>/` (one level deep) | `RunTraceDrawer/_components/TraceBody/`, `AgentEditor/_components/ConfigTab/` |
| Used by 2+ pages | `src/components/<Name>/` | `RunCostBadge/`, `repo-not-found/` (`/pulls` + `/pulls/[number]`) |
| Used by 2+ pages of one section | or that section's `_components/` | `app/agents/_components/AgentCard/` (`/agents` + `/agents/[id]`) |
| Server read or mutation | a hook in `src/lib/hooks/<domain>.ts` over `src/lib/api.ts` | `lib/hooks/reviews.ts` |
| Component-local React logic | `<Name>/hooks/use<Thing>.ts` | `components/app-shell/hooks/useGlobalShortcuts.ts` |
| Pure logic of one component | `<Name>/helpers.ts` | `FindingsPanel/helpers.ts` |
| Pure logic used in 2+ places | `src/lib/<topic>.ts` (kebab-case) | `lib/github-urls.ts`, `lib/model-label.ts` |
| Helpers, constants, styles of a page | next to `page.tsx` | `app/repos/[repoId]/pulls/{helpers,constants,styles}.ts` |
| App-wide context or provider | `src/lib/<name>.tsx` | `lib/toast.tsx`, `lib/theme.tsx`, `lib/repo-context.tsx` |
| Generic UI primitive | not in app code: `@devdigest/ui` (`src/vendor/ui`) | `client/AGENTS.md` |

## Rules

1. **Direction:** `app → components → lib → vendor`. `lib/` never imports `components/` or `app/`, and `components/` never imports `app/` (0 such imports on 2026-11-26).
2. **Colocate first.** Move a piece out of its route only when a *second page* imports it, and no higher than needed.
3. **New folders are PascalCase** (root `AGENTS.md`, Naming). Six legacy kebab-case folders in `src/components/` are drift: don't copy them, and don't rename them in passing.
4. **Imports that leave the component's own folder use `@/…`** (`client/tsconfig.json:23`, `client/vitest.config.ts:9`), never `../../../`.
5. **Don't introduce** `features/`, `src/hooks/`, `src/utils/`, `*.utils.ts` or `<Name>.constants.ts` names, route groups, server actions, route handlers or CSS modules. None exist, and the client talks only to the API.
6. **`"use client"` on `page.tsx` is normal here** (5 of 7 pages): pages read data through TanStack Query hooks. RSC refactors belong to `next-best-practices`.

## Reference files — read the one that matches the task

- The real map of `client/src`, the promotion ladder, naming, known drift → [folder-structure.md](folder-structure.md)
- Splitting a large component in this layout, step by step → [component-organization.md](component-organization.md)
- App Router specifics here: `_components` nesting, page-level files, what we don't use → [nextjs-organization.md](nextjs-organization.md)

## Changelog

- **2.0.0** (2026-11-26) — Rewritten for DevDigest `client/`: generic structure advice replaced by the repo's real placement table, with precedents. Rules that contradict the code are gone: `*.utils.ts`, `src/hooks`, server actions, "push `use client` down", the 3–4 level nesting cap. Text that duplicates `client/AGENTS.md`, `react-best-practices` or `next-best-practices` is gone. Removed the link to `vercel-react-best-practices`, which is not installed. Added known drift.
- **1.0.0** (2026-06-18) — Lecturer's original (Lesson 02, Lab 02), generic React/Next.js.
