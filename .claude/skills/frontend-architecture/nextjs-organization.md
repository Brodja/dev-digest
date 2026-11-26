# Next.js App Router — how this client uses it

What `_folders`, route groups, layouts and route handlers *are* is covered by `next-best-practices` (`file-conventions.md`: Project Structure, Private Folders, Middleware / Proxy). This file says which of them DevDigest uses, and how.

## What we use

- **Private `_components/` per route segment.** Every route keeps its UI in `_components/`, which Next never routes. Nesting is one level inside a component folder (see [component-organization.md](component-organization.md#stop-conditions)).
- **Thin pages.** A page reads route params, calls `lib/hooks`, and composes `_components`. Four pages are 7–49 lines; the three data pages are 124–185 (the PR-detail page wires tabs and the trace drawer).
- **Page-level files next to `page.tsx`** for helpers, constants and styles that only the page uses: `app/repos/[repoId]/pulls/{helpers,constants,styles}.ts`.
- **`"use client"` pages.** 5 of 7 `page.tsx` files are client components, because data comes from the Fastify API through TanStack Query hooks (`lib/hooks/*`). `app/agents/page.tsx` and `settings/[section]/page.tsx` stay server components that render one client view. Don't convert pages to RSC data fetching as part of a placement change; that is a `next-best-practices` decision.
- **One root layout:** `src/app/layout.tsx` (with providers from `lib/providers.tsx`). The app shell is a component (`components/app-shell`) that each page renders, not a nested layout.
- **i18n:** `src/i18n/request.ts` configures next-intl; strings live in `client/messages/en/<namespace>.json`.

## What we don't use — and what to do instead

| Not used | Why | Instead |
|----------|-----|---------|
| Route groups `(group)/` | one layout, no URL sections that need their own layout | plain segments |
| Server actions, `"use server"`, `route.ts` handlers | the client talks only to the API (`client/AGENTS.md`) | a mutation hook in `lib/hooks/<domain>.ts` |
| `middleware.ts` | no auth or redirects at the edge | client-side redirects, as in `app/page.tsx` |
| `src/features/<x>/` | features are routes; colocation under `app/` already groups them | `app/<route>/_components/` |
| `src/hooks/`, `src/utils/` | hooks live in `lib/hooks` or the component's `hooks/`; pure code in `helpers.ts` or `lib/<topic>.ts` | see [folder-structure.md](folder-structure.md) |
| CSS modules; Tailwind utility classes in app code | Tailwind v4 is loaded only for the design system (`src/vendor/ui/styles.css:1`). App code uses its `mono`/`tnum` classes (`styles.css:144`, `:221`) and nothing else | `styles.ts` objects + CSS variables (`client/AGENTS.md`) |

Adding any of these is an architecture change: propose it, don't slip it in with a feature.
