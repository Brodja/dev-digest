# client — `@devdigest/web`

Next.js 15 App Router studio. Talks only to the API (`NEXT_PUBLIC_API_BASE`, default `http://localhost:3001`).

Read first: [INSIGHTS.md](INSIGHTS.md). More: [README.md](README.md) (route map) · [docs/](docs/README.md) ·
[specs/](specs/README.md) · [design system](src/vendor/ui/README.md) · browser journeys in [../e2e](../e2e/README.md)

## Map

- `src/app/**/page.tsx` — thin; feature UI lives in colocated `_components/<Name>/`.
- `src/lib/hooks/*` — every server call (TanStack Query) → `src/lib/api.ts`. Components don't call the API directly.
- `src/components/` — cross-page pieces (app shell, diff viewer).
- `src/vendor/ui/` — design system `@devdigest/ui`; `src/vendor/shared/` — contracts copy.
- `messages/en/<namespace>.json` — UI strings (next-intl).

## Conventions

- Component folder `<Name>/`: `<Name>.tsx`, `index.ts` (re-export), optional `styles.ts` (`export const s = {…}`, values `satisfies CSSProperties`), `constants.ts`, `helpers.ts` (pure), `<Name>.test.tsx`.
- Import UI only from the `@devdigest/ui` barrel, never from its inner files.
- Colors via CSS variables (`var(--accent)`, `var(--crit)`), not hex.
- New user-facing strings: `useTranslations("<ns>")` + a key in `messages/en/<ns>.json`.
- After a mutation, invalidate the same query key the reading hook uses (e.g. `["reviews", prId]`).
- Tests: vitest + jsdom with `fetch` mocked — no API or browser needed.

## Do not touch

- `src/vendor/shared/**` — copy of `server/src/vendor/shared`; change the server copy first, then mirror here.
- `.next/` — build output.
