# Component organization — splitting a component in this layout

*When* to split (container vs presentational, size, one component per file, state colocation, data fetching in hooks) is covered by `react-best-practices` (`SKILL.md`: Component Design, State Management, Data Fetching, Code Organization). This file covers only *where the pieces go* in DevDigest.

## Steps

1. **Server data out of the component.** Never fetch in a component: add or extend a hook in `src/lib/hooks/<domain>.ts`. After a mutation, invalidate the same query key the reading hook uses (`client/AGENTS.md`).
2. **Sub-UI → a child folder.** An inner section goes to `<Parent>/_components/<Child>/` with `<Child>.tsx` and `index.ts`. The parent imports `./_components/<Child>`. Precedent: `RunTraceDrawer` (`RunTraceDrawer.tsx:17` imports `./_components/TraceBody`) and its six section children.
3. **A standalone piece → a route sibling.** If the extracted piece makes sense alone (it renders one entity, could be tested alone), make it a sibling in the route's `_components/` instead. Precedent: `FindingCard` sits next to `FindingsPanel`, its only importer.
4. **Pure logic → `helpers.ts`, values → `constants.ts`, style objects → `styles.ts`** in the same folder (anatomy in `client/AGENTS.md`). Precedent: `FindingsPanel/` has all three, plus `FindingsPanel.test.tsx`.
5. **Stateful logic reused by the parent's children → `<Parent>/hooks/use<Thing>.ts`.** Precedent: `components/app-shell/hooks/` (`useGlobalShortcuts`, `useShellCommands`, `useShellContext`). Logic used once can stay in the component.
6. **Second page needs it → promote** (ladder in [folder-structure.md](folder-structure.md#promotion-ladder)) and switch its importers to `@/…`.

## Stop conditions

- Nested `_components` go **one level deep** inside a component folder, as they do today (`AgentEditor/_components/ConfigTab`, `FindingsPanel/_components/SeverityFilter`, `SettingsView/_components/*`). If a child needs its own children, make it a route sibling (step 3).
- Don't create a folder for a piece that only forwards props. Keep it in the parent file.

## Where splitting would pay off next

The largest app files today (lines): `components/showcase/Showcase.tsx` 259, `pulls/[number]/_components/RunHistory/RunHistory.tsx` 236, `lib/hooks/reviews.ts` 216, `pulls/[number]/page.tsx` 185. Split them only when a task touches them, not as a drive-by.
