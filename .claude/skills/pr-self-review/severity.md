# Severity — scale, NEW vs OLD, CRITICAL catalog

## 1. Scale

Same values as the findings contract (`server/src/vendor/shared/contracts/findings.ts`: `CRITICAL | WARNING | SUGGESTION`).

| Severity | Means | Verdict |
|----------|-------|---------|
| **CRITICAL** | matches the closed catalog (§3) and sits on an added line | any one → `NOT READY — не відкривай PR` |
| **WARNING** | a real problem worth fixing before review: architecture drift, missing test for changed logic, risky pattern | reported, doesn't block |
| **SUGGESTION** | style, naming, readability | reported, doesn't block |

## 2. NEW vs OLD (deterministic checks)

A failure is **NEW** (a CRITICAL) when the branch caused it. It is **OLD** (listed in the report's "pre-existing" section, never in the verdict) when it would fail on main too.

- **Typecheck error** — NEW if it is in a changed file, or in a file that imports something the branch changed. If it is elsewhere and clearly unrelated, check it on the base before calling it OLD.
- **Failing unit test** — NEW if the test file changed, or it imports (directly) a changed file, or the failure names changed code. Otherwise OLD. Known OLD on Windows: 8 server unit tests (`contained-read`, `git-adapter-safety`, `indexer-pipeline`) fail on POSIX assumptions (`server/INSIGHTS.md`, 2026-11-21 · measured).
- **depcruise** — `depcruise-changed.mjs` classifies by itself: `CRITICAL` (error rule, import line is new), `WARNING` (warn rule, import line is new), `OLD` (violation in a touched file, import not new). Violations in untouched files are only counted. There is no fixed baseline number.

## 3. Closed CRITICAL catalog

Only these block, whatever severity a source skill uses. Everything else is at most WARNING.

**Deterministic (no skeptic pass needed)**
- NEW typecheck error or NEW failing unit test (§2).
- depcruise `CRITICAL` line (an error rule of `onion-architecture`, new import).
- Hard flags from scope: `migration-edit`, `wrong-lockfile`, `secret-file`.

**Backend (judged, then skeptic pass)**
- I/O added to `reviewer-core` outside `llm/`, or a service or route reaching an adapter, when the gate can't see it (e.g. a dynamic import).
- Request body, params or query used without a Zod schema in the route's `schema` (`server/AGENTS.md`, Conventions), or any other untrusted input that reaches a query, shell or path unvalidated.
- A server contract change in `server/src/vendor/shared` that the client uses, without mirroring `client/src/vendor/shared` (`server/AGENTS.md`, Gotchas). The copies *already* differ (eval-ci, knowledge, productionize, trace), so "the copies differ" alone is not a finding. The change has to be new and the client has to use it.
- A field added to `RunTrace` / `RunStats` that is not optional (`.nullish()`): old stored traces are never migrated (`server/INSIGHTS.md`, 2026-11-21 · dependency).

**Client (judged, then skeptic pass)**
- A value (non-`import type`) import from `@devdigest/shared`: tsc and vitest pass, but the Next dev page returns 500 (`client/INSIGHTS.md`, 2026-11-21 · fix).
- Hook rule violation (conditional or looped hook, a dependency array that loops or goes stale) or a side effect during render (`react-best-practices`, Hooks).

**Any surface**
- A secret or credential in an added line (key, token, password, private URL with credentials).

## 4. General check (every surface)

- Secrets in added lines.
- Do-not-touch paths from root `AGENTS.md` and package `AGENTS.md` (scope flags most of them).
- Relative links and `path:line` references in changed `.md` files resolve.
- Changed `SKILL.md`: `name` and `description` present; the description is one quoted line of at most 1024 characters.
- Changed docs agree with the code they describe (a rule or command that no longer exists → WARNING).

## 5. Mapping source skills onto the scale

| Source | → CRITICAL | → WARNING | → SUGGESTION |
|--------|-----------|-----------|--------------|
| `onion-architecture` gate | error rule, new | warn rule, new | — |
| `onion-architecture` placement (decision list) | catalog items only | wrong ring / module boundary | naming |
| `frontend-architecture` | — | wrong place, missed promotion, new drift (kebab folder, `../../../`) | naming nits |
| `react-best-practices` | catalog items only | its CRITICAL / HIGH rules otherwise | its MEDIUM rules |
| `next-best-practices` | — | RSC / boundary / data-fetching mistakes | conventions |
| `react-testing-library` | — | changed logic with no test, or a test that can't fail | query priority, style |
| `fastify-best-practices` / `drizzle-orm-patterns` | catalog items only | correctness: error handling, transactions, N+1 | style |
| `zod` / `postgresql-table-design` | catalog items only | wrong or missing constraint, unsafe parse | style |
| `security` | its CRITICAL, or HIGH that matches a catalog item | its other HIGH | — (it reports HIGH confidence only) |

## 6. Skeptic pass

Give one subagent the judged CRITICALs: rule, `file:line`, the claim, and the cited code. Prompt it to **refute** each:

- Is the line really added on this branch?
- Does it really match the catalog item?
- Is the input really untrusted, and is the import really a value import?
- Default to *refuted* if unsure.

Survivors stay CRITICAL. Refuted ones become WARNING with `downgraded: <reason>`, listed in the report. Deterministic CRITICALs (§3, first group) skip this pass: they are facts.
