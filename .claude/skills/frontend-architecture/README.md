# frontend-architecture — provenance & sources

Human-facing notes for the `frontend-architecture` skill. The agent-facing rules live in [SKILL.md](SKILL.md) and its reference files. Version and changelog: [SKILL.md](SKILL.md#changelog).

- **Scope:** where code lives in DevDigest `client/` (Next.js 15 App Router, React 19, TanStack Query, next-intl) and how to split it.
- **Out of scope:** `server/` and `reviewer-core/` → `onion-architecture`.
- **Origin:** v1.0.0 by the course lecturer (Lesson 02, Lab 02) was a generic React/Next.js organization guide. v2.0.0 (2026-11-26) rewrites it against this repo. Every placement rule now cites a precedent in `client/src`, and the generic advice is either replaced by what the code actually does or left to the neighbouring skills.

## Files

| File | Covers |
|------|--------|
| [SKILL.md](SKILL.md) | placement table, six rules, routing to neighbours |
| [folder-structure.md](folder-structure.md) | real map of `client/src`, promotion ladder, `helpers.ts` vs `lib/`, naming, known drift |
| [component-organization.md](component-organization.md) | splitting a component in this layout, stop conditions, current split candidates |
| [nextjs-organization.md](nextjs-organization.md) | which App Router features the client uses, and what to do instead of the ones it doesn't |

## Relationship to other skills

| Skill | Owns | This skill defers when… |
|-------|------|-------------------------|
| `react-best-practices` | component design, state, hooks, data-fetching correctness, size limits | the question is "is this code right?", not "where does it go?" |
| `next-best-practices` | file conventions, RSC boundaries, data fetching, route handlers | the question is about Next.js mechanics |
| `react-testing-library` | how to write component tests | writing the test (tests sit next to the component: `client/AGENTS.md`) |
| `onion-architecture` | backend layering and its dependency gate | the code is in `server/` or `reviewer-core/` |

`client/AGENTS.md` owns the component-folder anatomy and the API, i18n, design-system and colour rules; this skill links to it instead of repeating it.

## Grounded in

`client/AGENTS.md`, root `AGENTS.md` (Naming), `client/INSIGHTS.md`, `client/README.md` (route map), `client/tsconfig.json`, `client/vitest.config.ts`, `client/src/**` (importer counts and file sizes measured 2026-11-26), `client/src/vendor/ui/styles.css`.

## Sources

Only the sources behind rules that survived the rewrite are kept. The lecturer's bibliography for feature-based/FSD structures, naming tables and server actions was dropped along with those rules. The lecturer README also linked `docs/react-frontend-best-practices-sources.md`, which does not exist in this repo.

### Colocation
- [Colocation — Kent C. Dodds](https://kentcdodds.com/blog/colocation)
- [State Colocation will make your React app faster — Kent C. Dodds](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster)
- [File Structure — Epic React (Kent C. Dodds)](https://www.epicreact.dev/modules/welcome-to-epic-react-v1/file-structure)
- [Delightful React File/Directory Structure — Josh W. Comeau](https://www.joshwcomeau.com/react/file-structure/) — component folder + `index.ts` re-export, the shape `client/` uses
- [React Folder Structure Best Practices — Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/)

### Next.js App Router organization
- [Getting Started: Project Structure — Next.js](https://nextjs.org/docs/app/getting-started/project-structure)
- [Project Organization and File Colocation — Next.js docs](https://nextjs.org/docs/13/app/building-your-application/routing/colocation)
- [Understanding Route Visibility and Colocation — DEV (Bridget Amana)](https://dev.to/bridget_amana/understanding-route-visibility-and-colocation-in-nextjs-app-router-2bni)
- [Next.js Colocation Template](https://github.com/arhamkhnz/next-colocation-template)

### Splitting components and extracting hooks
- [Reusing Logic with Custom Hooks — react.dev](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Separation of concerns with React hooks — Felix Gerschau](https://felixgerschau.com/react-hooks-separation-of-concerns/)
- [Techniques for decomposing React components — David Tang (DailyJS)](https://medium.com/dailyjs/techniques-for-decomposing-react-components-e8a1081ef5da)
- [7 Architectural Attributes of a Reliable React Component — Dmitri Pavlutin](https://dmitripavlutin.com/7-architectural-attributes-of-a-reliable-react-component/)
