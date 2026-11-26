# Folder structure — the real map of `client/src`

Checked 2026-11-26. Paths are relative to `client/`.

## Map

```
src/
├── app/                      # routes; feature UI colocated per route
│   ├── layout.tsx  globals.css  page.tsx (redirects to first repo / onboarding)
│   ├── agents/  _components/{AgentCard,AgentsListView}/   [id]/_components/AgentEditor/
│   ├── onboarding/_components/AddRepoView/
│   ├── repos/[repoId]/pulls/  {helpers,constants,styles}.ts  _components/{FilterBar,PRRow}/
│   │   └── [number]/_components/   12 sibling components (DiffTab … VerdictBanner)
│   └── settings/[section]/_components/SettingsView/
├── components/               # pieces shared by 2+ pages (+ some legacy, see drift)
├── lib/                      # api.ts, hooks/<domain>.ts, providers/contexts, pure topic helpers
├── i18n/request.ts           # next-intl config (strings live in client/messages/en/*.json)
├── test/                     # setup.ts, smoke.test.tsx
└── vendor/                   # ui/ = @devdigest/ui design system · shared/ = contracts copy
```

The route list and the API each page uses: `client/README.md` ("UI route map").

## Promotion ladder

1. Inside the component file.
2. `<Name>/helpers.ts`, `constants.ts`, `styles.ts`, `hooks/use<Thing>.ts`, `_components/<Child>/`.
3. Flat in the route's `_components/` — the default home of a route's components.
4. The section's `_components/` when two pages of one section share it (`app/agents/_components/AgentCard/`, used by `app/agents/_components/AgentsListView/AgentsListView.tsx` and `app/agents/[id]/page.tsx`).
5. `src/components/<Name>/` when pages share it (`RunCostBadge` is imported by `PRRow`, `ReviewRunAccordion`, `RunHistory` and `TraceBody`).
6. `src/lib/<topic>.ts` for non-React logic used in 2+ places (`lib/github-urls.ts` and `lib/model-label.ts` each have 2 importers).

Move one step at a time, and only when a real consumer appears. Keep the folder's `index.ts` re-export, so a move changes only the import path.

## `helpers.ts` vs `lib/` vs `vendor/ui`

- `<Name>/helpers.ts` — pure functions for that component or route (`client/AGENTS.md`: "pure"). No React, no fetch.
- `src/lib/<topic>.ts` — pure or app-wide code shared across features, plus providers and contexts (`toast.tsx`, `theme.tsx`, `repo-context.tsx`, `providers.tsx`). `lib/` imports neither `components/` nor `app/`.
- `src/lib/hooks/<domain>.ts` — every TanStack Query hook (32 hooks in 5 domain files: `core`, `agents`, `reviews`, `trace`, `repo-intel`; barrel `lib/hooks/index.ts`). Outside `lib/`, code imports only `ApiError` from `lib/api.ts`, for error checks.
- `src/vendor/ui` — the design system. App-specific components never go there.

## Naming

- Folders for components: PascalCase (`FindingCard/`), file `<Name>.tsx`. The rest of the folder anatomy is in `client/AGENTS.md`.
- Hooks: `use<Thing>.ts` in `<Name>/hooks/`, with an `index.ts` barrel (`components/app-shell/hooks/`).
- `lib/` files and domain hook files: kebab-case (`github-urls.ts`, `lib/hooks/repo-intel.ts`).
- Imports leaving the component's own folder: `@/…`. The alias is defined for both tsc (`tsconfig.json:23`) and vitest (`vitest.config.ts:9`).

## Known drift — don't copy, don't fix in passing

| Drift | Evidence | Rule for new code |
|-------|----------|-------------------|
| Kebab-case folders in `src/components/`: `app-shell`, `diff-viewer`, `mermaid-diagram`, `page-shell`, `repo-not-found`, `showcase` | `RunCostBadge/` and every `_components/*` are PascalCase; root `AGENTS.md` Naming | PascalCase |
| Deep relative imports: 31 files use `../../../` or deeper, 15 use `@/` | `ConfigTab.tsx:7` imports `"../../../../../../../lib/hooks/agents"` | `@/lib/hooks/agents` |
| Not everything in `src/components/` is shared: `mermaid-diagram` has no importer, `showcase` only the smoke test, `page-shell` only the root page, `diff-viewer` one route | importer search on 2026-11-26 | promote by rule 5, don't infer "shared" from location |
| `RunTraceDrawer/_components/atoms.tsx` — a loose file of tiny pieces shared by its children | the only such file | fine for a few tiny pieces; otherwise one folder per child |
