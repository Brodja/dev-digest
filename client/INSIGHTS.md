# client — insights

Entry format: `YYYY-MM-DD · category · insight · file:line`

- 2026-11-21 · oddity · FindingsPanel/visibleFindings sorts only within ONE review run (ReviewRunAccordion renders a FindingsPanel per review), never across agents; ties inside a severity keep API order, which is unordered because reviewsForPull selects findings with no ORDER BY — add an orderBy server-side if a deterministic order is needed · client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/helpers.ts:5-10, client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx:150, server/src/modules/reviews/repository/review.repo.ts:69
- 2026-11-21 · oddity · INFO severity exists only in the UI (SEVERITY_ORDER, SEV_COLOR, design-system Severity type) — the shared Severity contract is CRITICAL|WARNING|SUGGESTION and LLM output is enum-constrained, so the API never returns INFO; don't add an INFO option to severity filters · client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/constants.ts:4-9, client/src/vendor/ui/primitives/tokens.ts:3, server/src/vendor/shared/contracts/findings.ts:11
