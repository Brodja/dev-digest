# 003 — Conventions Extractor

The Conventions Extractor turns the house rules that live only in the code into a skill. It picks sample files from the
repository by code, asks a cheap model once for candidate conventions, and keeps only the ones whose evidence it can find
in those files. The user accepts, rejects or edits each candidate, then builds a `repo-conventions` skill (type
`convention`, source `extracted`) from the accepted ones in an editable modal. That skill is linked to an agent like any
other and shows up in the run trace's skills block.
Homework L02. Spans server + client; this file is the spec, `client/specs/003-conventions.md` links here. Builds on
[002 — Skills](002-skills.md).

## Why

The starter has the pieces, but nothing connects them:

- Table `conventions` exists (`src/db/schema/knowledge.ts:31-42`: `rule`, `evidence_path`, `evidence_snippet`,
  `confidence`, `accepted`, `repo_id`), but no module reads or writes it. It has no line numbers, no commit sha, no
  rejected state and no `created_at`.
- Contract `ConventionCandidate` exists (`src/vendor/shared/contracts/knowledge.ts:194-202`, identical client copy) and is
  used nowhere.
- `repoIntel.getConventionSamples(repoId, n)` (`src/modules/repo-intel/service.ts:630-632`, facade
  `repo-intel/types.ts:163`) returns the top-ranked source paths without tests, configs or migrations, and calls no model.
  It returns `[]` when repo-intel is off or the repo has no index.
- Feature model `conventions` is registered (`src/vendor/shared/contracts/platform.ts:72-78`, default `openai` /
  `gpt-5.4`) and the resolver exists (`src/modules/settings/feature-models.ts:36-57`), but no product code calls it.
- `MockLLMProvider` can return a fixture per schema name (`src/adapters/mocks.ts:51-56`, `:94`). Its comment expects a
  two-step dialogue (`ConventionFileSelection` → `ConventionExtraction`); this feature uses one call (see Decisions).
- `SkillsService.create(workspaceId, input, source)` (`src/modules/skills/service.ts:61-78`) takes the source from the
  caller; 002 reserves `extracted` for this module (`specs/002-skills.md`, Decisions). The service is built only inside
  `skills/routes.ts:64` and is not reachable from another module without a cross-module import.
- Client: `messages/en/conventions.json` has the page strings and is unused; `activeKeyFor` already maps `/conventions`
  (`client/src/components/app-shell/helpers.ts:31`), but `client/src/vendor/ui/nav.ts:21-30` has no item and no route
  exists under `client/src/app`.

Nothing else is needed for the last step: any enabled skill with an enabled link reaches the prompt
(`src/modules/agents/repository.ts:229`, `activeSkillsForAgent`), and `extracted` is a trusted source
(`knowledge.ts` `TrustedSkillSource`, `src/platform/skill-trust.ts`), so it is sent without the `<untrusted>` wrapper and
listed in the trace's skills block with its tokens. The run executor does not change.

## Concepts

| Term | Meaning |
|---|---|
| Scan | One extraction run for one repo: code picks files → one model call → code checks evidence → candidates stored. Recorded in `convention_scans`, failed or not. |
| Sample set | The files sent to the model: 12 source files spread over packages from up to 400 ranked candidates of `getConventionSamples`, + up to 6 config files found by name (every package's `tsconfig.json` first). Fixed by code before the call. |
| Candidate | A convention proposed by the model **and grounded by code**: rule text + one evidence range (`path`, `start_line`–`end_line`, the real lines) + confidence. |
| Status | `pending` (new), `accepted`, `rejected`. Stored as two flags (`accepted`, `rejected`, never both); the API sends `status`. |
| Grounded | `evidence_path` is one of the files in the sample set, and the snippet is found in that file's text (whitespace-normalised). Anything else is dropped before the DB. |
| Decided rule | An accepted or rejected candidate. Survives re-scans; the model is told not to propose it again and code drops near-duplicates. |

## Data

One migration: edit `src/db/schema/knowledge.ts`, then `pnpm db:generate --name conventions_extractor` → read the SQL
(it must touch only `conventions` and `convention_scans`) → `pnpm db:migrate`. Applied migrations are never edited. The
change is additive only, so drizzle-kit generates it without its rename prompt (that prompt appears when a column is
added and another dropped in the same table).

| Table | Change |
|---|---|
| `conventions` | `rejected boolean NOT NULL DEFAULT false`; `evidence_start_line integer`; `evidence_end_line integer`; `commit_sha text`; `created_at timestamptz NOT NULL DEFAULT now()`; `CHECK (NOT (accepted AND rejected))` (`check()` from `drizzle-orm/pg-core`, drizzle-orm 0.45.4); index `(workspace_id, repo_id)` |
| `convention_scans` (new) | `id uuid pk`; `workspace_id` FK → `workspaces` cascade; `repo_id` FK → `repos` cascade, NOT NULL; `status text` enum `succeeded \| failed`; `error_code text`; `error_message text`; `provider text`; `model text`; `commit_sha text`; `files jsonb` (`string[]`, the sample set); `proposed`, `kept`, `dropped_ungrounded`, `dropped_duplicate` (integer, default 0); `tokens_in`, `tokens_out`, `attempts` (integer, nullable); `cost_usd double precision`; `started_at`, `finished_at timestamptz`; index `(repo_id, started_at)` |

- Row types `ConventionRow` and `ConventionScanRow` go in `src/db/rows.ts`, so `helpers.ts` never imports the schema.
- The existing nullable columns stay as they are. Every row this module writes has `repo_id`, `evidence_path`,
  `evidence_snippet`, both line numbers and `confidence`; the list query skips rows without `evidence_path`.
- `status` → flags: `pending` = (false, false), `accepted` = (true, false), `rejected` = (false, true). The repository
  writes both flags in one statement, and the CHECK constraint backs it up.
- Only the latest scan of a repo is read; older scan rows are history.

## Contracts

Server copy first (`src/vendor/shared/contracts/knowledge.ts`), then mirrored into `client/src/vendor/shared`; the client
imports them with `import type` only. Extending `ConventionCandidate` is safe: nothing consumes it yet.

```ts
// contracts/knowledge.ts
ConventionStatus = z.enum(['pending', 'accepted', 'rejected'])
ConventionCandidate = z.object({
  id, rule, evidence_path, evidence_snippet,          // unchanged; evidence_snippet = the file's real lines
  confidence: z.number().min(0).max(1),               // unchanged
  accepted: z.boolean(),                              // unchanged, = status === 'accepted'
  status: ConventionStatus,
  evidence_start_line: z.number().int().positive(),
  evidence_end_line: z.number().int().positive(),
  commit_sha: z.string().nullable(),                  // HEAD the evidence was checked against
  created_at: z.string(),
})
ConventionScan = z.object({
  id, status: z.enum(['succeeded', 'failed']),
  error_code: z.string().nullable(), error_message: z.string().nullable(),
  provider: z.string().nullable(), model: z.string().nullable(), commit_sha: z.string().nullable(),
  files: z.array(z.string()),
  proposed: int, kept: int, dropped_ungrounded: int, dropped_duplicate: int,
  tokens_in: int.nullable(), tokens_out: int.nullable(), attempts: int.nullable(), cost_usd: z.number().nullable(),
  started_at: z.string(), finished_at: z.string(),
})
ConventionsState = z.object({ scan: ConventionScan.nullable(), candidates: z.array(ConventionCandidate) })
```

The model-facing schema is internal to the module (`src/modules/conventions/prompt.ts`), not a shared contract:

```ts
ConventionExtraction = z.object({
  conventions: z.array(z.object({
    rule: z.string(), evidence_path: z.string(), evidence_snippet: z.string(), confidence: z.number(),
  })),
})
```

No `.optional()` (OpenAI strict `json_schema` turns it into a warning and a required field) and no `.min/.max` (models
answer `85` or `1.2`, and a failed parse costs a repair request). Code clamps `confidence` to 0..1 and caps the list.

## API (snake_case)

| Route | Body | Response |
|---|---|---|
| `GET /repos/:id/conventions` | — | `ConventionsState`: the latest scan (or `null`) and every candidate of the repo, sorted pending → accepted → rejected, then confidence desc, then rule (a stable order: one scan's rows share `created_at` and often confidence) |
| `POST /repos/:id/conventions/extract` | — | `ConventionsState` after the scan. Synchronous: one model call. Route rate limit 5 / minute (precedent `src/modules/reviews/routes.ts:29`) |
| `PATCH /repos/:id/conventions/:conventionId` | `{ status?: ConventionStatus, rule?: string }` — at least one field (`.refine`); `rule` trimmed, 1–500 chars | `ConventionCandidate` |
| `POST /repos/:id/conventions/skill` | `{ name, description, body, convention_ids: uuid[] }` (1–100, unique); `name` / `description` / `body` follow the skill rules of 002 | 201 `Skill` with `type = convention`, `source = extracted`, `enabled = true`, `version = 1` |

- Params: `{ id: uuid }` and `{ id: uuid, conventionId: uuid }`; a non-uuid → 422 at the edge.
- Every route is workspace-scoped: a repo or convention of another workspace → 404.
- Errors use the shared handler (`{ error: { code, message, details } }`):

| Status | Code | When |
|---|---|---|
| 404 | `not_found` | repo or convention missing, or in another workspace |
| 409 | `repo_not_cloned` | the repo has no `clone_path` |
| 409 | `repo_intel_disabled` | no samples and `getIndexState().degradedReason = 'flag_off'` |
| 409 | `repo_not_indexed` | no samples for any other reason (`details.reason` = the degraded reason, if any) |
| 409 | `repo_changed` | HEAD moved while the files were being read (a sync ran); retry |
| 409 | `extraction_running` | a scan of this repo is already running in this process |
| 409 | `skill_name_taken` | from `SkillsService.create` |
| 422 | `validation_error` | Zod: params, empty PATCH, rule length, skill fields |
| 422 | `conventions_not_accepted` | a `convention_id` is not an accepted convention of this repo (`details.ids`) |
| 500 | `config_error` | the provider's API key is missing (`ConfigError` from `container.llm`, passed through) |
| 502 | `llm_failed` | the model call failed or its output did not parse after the repair attempt |
| 502 | `llm_bad_output` | every proposed rule was a fragment (degenerate output); pending candidates are kept |

Every error raised after the repo was found and the scan started is also stored as a `failed` scan (`error_code`,
`error_message`), so the page shows the reason after a reload. `not_found` and `extraction_running` are not stored.

## Extraction pipeline

`ConventionsService.extract(workspaceId, repoId)`:

1. **Repo.** Workspace-scoped query in the module's own repository: `owner`, `name`, `full_name`, `default_branch`,
   `clone_path` (like `src/modules/repo-intel/repository.ts:136`, `getRepoBasics`). Missing → 404.
2. **One scan at a time.** An in-memory `Set` of running repo ids on the service instance (one per app; the routes plugin
   builds it once) → 409 `extraction_running`. The DB write in step 8 is transactional anyway; the set only saves a
   second model call.
3. **Sample set, chosen by code.**
   - No `clone_path` → 409 `repo_not_cloned`.
   - `container.repoIntel.getConventionSamples(repoId, 400)` → ranked candidates (one DB query, no file read), then
     `spreadSamples(candidates, 12)`: group by package (first path segment), round-robin one file per package in turn,
     and inside a package round-robin over directories; rank order is kept inside each group; paths under a
     dot-directory (`.claude`, `.github`) are skipped. Empty → `container.repoIntel.getIndexState(repoId)` decides
     between `repo_intel_disabled` and `repo_not_indexed`; no model call is made.
   - Config files by name, probed at the repo root and in each distinct first-level directory of the samples (a monorepo
     keeps them per package, e.g. `server/tsconfig.json`): first `tsconfig.json` of the root and of every package, then
     `eslint.config.{js,mjs,cjs,ts}`, `.eslintrc`, `.eslintrc.{json,js,cjs}`, `.prettierrc`, `.prettierrc.json`,
     `prettier.config.{js,mjs,cjs}` per directory, root first. At most 6.
   - Every read goes through the `GitClient` port: `container.git.readFile({ owner, name }, path)` (realpath containment
     in `src/adapters/git/simple-git.ts:267-276`; `MockGitClient({ files })` in tests). A read that throws, or returns
     empty text, means "absent" (the mock returns `''` for unknown paths). Files with a NUL byte or a line over 1 000
     characters (minified) are skipped.
4. **Prepared text.** Each file is normalised once: CRLF / CR → LF, leading BOM removed, Unicode NFC. Then it is cut as a
   prefix at a line boundary (≤ 250 lines and ≤ 12 KB), so line numbers stay those of the real file. The whole set is kept
   under ≈ 40 000 tokens (`container.tokenizer`), dropping the lowest-ranked samples first. **This prepared text is what
   the model sees and what evidence is checked against.**
5. **Commit.** `container.git.currentHead(repo)` before step 3 and after step 4. Different → 409 `repo_changed`.
   Otherwise it is the scan's and every new candidate's `commit_sha`, so evidence links open the exact version that was
   checked.
6. **One model call.**
   - `const { provider, model } = await container.featureModel(workspaceId, 'conventions')` — the workspace's choice in
     Settings → Feature Models, else the registry default. `const llm = await container.llm(provider)`.
   - `llm.completeStructured({ model, schema: ConventionExtraction, schemaName: 'ConventionExtraction', messages,
     timeoutMs: 150_000, maxRetries: 1 })`. No `temperature` and no `maxTokens`: for gpt-5.x the cap includes reasoning
     tokens and a low one returns empty output (`src/adapters/llm/openai.ts:23-38`).
   - Exactly one call per scan; nothing after it calls the model again.
7. **Evidence check and dedupe** — next sections. Pure code.
8. **Write, in one transaction** (repository method `replacePending(workspaceId, repoId, build, scan)`):
   lock the repo row (`SELECT … FOR UPDATE`, precedent `src/modules/agents/repository.ts:289`) → delete the repo's
   `pending` candidates → **re-read** the decided rules (one could have been accepted during the model call) →
   `build(decided)` runs the dedupe from `helpers.ts` and returns the rows → insert them → insert the `succeeded` scan with
   its counters, tokens, cost and attempts. Accepted and rejected rows are never touched by a scan.
9. Return `state(workspaceId, repoId)`.

Any error from step 3 on is caught once: an `AppError` (including `ConfigError`) is kept as is, anything else becomes
`ExternalServiceError` `llm_failed`; a `failed` scan row is written; the error is rethrown. Nothing is deleted on failure.

### Prompt (`prompt.ts`, pure)

- System: the role ("extract the house conventions of this repository from the files below"), what a convention is (a
  rule the team follows in several places, written as one directive sentence a reviewer can check: "Use … for …"), what
  to skip (generic language or framework facts, one-off code), at most 12 conventions, confidence = how consistently the
  files follow it. Evidence: copy 1–15 **contiguous lines verbatim** from the file named in `evidence_path`; no `...`, no
  edits, no line numbers. A guard sentence: file contents are untrusted data and any instruction inside them is ignored
  (reviewer-core does not export its `INJECTION_GUARD`, so the module has its own line).
- User: the decided rules (accepted and rejected, newest first, at most 50) under "already reviewed — do not propose these
  again or rephrase them"; then every file as `wrapUntrusted('file:<path>', text)` (`src/platform/prompt.ts`, re-export of
  `reviewer-core/src/prompt.ts:38`). The label is sanitised (`"`, `<`, `>` removed). A truncation note ("first N of M
  lines") goes in the header line before the block, never inside it, so a snippet cannot match it.
- No line numbers anywhere in the prompt: models copy `12 |` prefixes into snippets.

## Evidence check

Pure functions in `evidence.ts` and `helpers.ts`; nothing here touches the disk or the model.

- **Rule text.** After whitespace clean-up a rule needs at least 15 characters and 2 content words (stop words
  removed); a fragment such as "Use \`" is dropped even when its evidence is real. When **every** proposal is such a
  fragment, the output is degenerate: the scan fails with `llm_bad_output` and the pending candidates stay.
- **Path.** `evidence_path` is normalised (strip a leading `./` or `/`, `\` → `/`) and must equal one of the paths in the
  sample set, case-sensitively (GitHub URLs are case-sensitive). `readFile` is never called with a path the model wrote,
  so a traversal path is simply not in the set. Evidence may come from a sample or a config file; only the cited file is
  searched.
- **Snippet clean-up.** Surrounding code fences are removed. If nothing matches and the snippet contains literal `\n`,
  it is unescaped and tried once more.
- **Match.** File text and snippet are both reduced to a whitespace-normalised form (every run of whitespace → one space,
  trimmed) with a map from each normalised offset back to its line. The first `indexOf` wins (deterministic when the
  snippet occurs more than once). If that fails and the snippet has at least 20 non-whitespace characters, a second pass
  removes all whitespace (catches `foo(a,b)` vs `foo(a, b)`).
- **Guards.** The snippet needs at least 16 non-whitespace characters (an empty snippet would "match" at offset 0). The
  matched range may span at most 40 lines (`end − start + 1`, measured in the file, not in the model's text). A snippet
  that runs past the truncation point is not found and is dropped.
- **Lines and stored text.** `evidence_start_line` / `evidence_end_line` come from the match. `evidence_snippet` stores
  the file's real lines `start..end` (trailing whitespace trimmed), not the model's text; a partial-line match expands to
  whole lines.
- **Confidence and cap.** Clamped to 0..1 (a value over 2 and up to 100 is read as a percentage, a small overshoot
  such as 1.2 becomes 1); at most 15 candidates are kept, highest confidence first.
- **Dedupe**, within the scan and against the decided rules: duplicate when the normalised rule texts (lower case,
  backticks and punctuation stripped, spaces collapsed) are equal, or their token sets (stop words removed) have Jaccard
  ≥ 0.8, or they cite the same file with overlapping lines and Jaccard ≥ 0.5. A rejected rule therefore does not come
  back on a re-scan, and an accepted one is not duplicated.
- The scan records `proposed` (model output count), `kept`, `dropped_ungrounded` (failed the code check: unusable rule
  text, or no evidence in a sent file) and `dropped_duplicate`.

## Skill from conventions

- The client builds the draft with a pure function from the accepted candidates (in P3: the accepted ones that are
  selected), in list order:
  - name `repo-conventions`; if the workspace already has it (from `GET /skills`), `repo-conventions-2`, `-3`, …;
  - description, a directive: "Flag changes that break the house conventions of `<repo>` listed below; cite the
    convention and the offending file:line.";
  - body: `# <name>`, one instruction line for the reviewer, then one bullet per rule with its evidence reference
    `` `path:Lstart-Lend` ``. **No code snippets**: `extracted` is a trusted source, so repository code inside the body
    would reach the prompt without the `<untrusted>` wrapper; the rules are short and were each accepted by a person,
    which is the trust boundary. The body stays under 40 000 chars.
- The modal shows name, description and body (all editable; type shown read-only as `convention`), Cancel and
  Create skill. Nothing is stored before *Create skill*.
- Server, `ConventionsService.createSkill(workspaceId, repoId, input)`: the repo must exist (404); every
  `convention_ids` entry must be an accepted convention of this repo, else 422 `conventions_not_accepted`; then
  `container.skills.create(workspaceId, { name, description, type: 'convention', body, enabled: true }, 'extracted')`.
  A taken name → 409 `skill_name_taken` (shown inline in the modal).
- The new skill is enabled and trusted. Linking it in the agent's Skills tab (002) and running a review puts it in the
  trace's skills block with its token count — no change to the executor.

## Module boundaries

Placement follows `onion-architecture`; the gate must stay at **0 errors, 20 warnings** (baseline 2026-11-26).

| Need | How, without a new warning |
|---|---|
| Create the skill through `SkillsService.create` | `SkillsService` takes a structural `SkillsDeps = { db: Db; archive: ArchiveReader }` instead of `Container` (it uses only those two; `archive` is still read lazily, so the test override applies). `container.ts` gets `get skills(): SkillsService`; since `skills/service.ts` no longer imports `Container`, there is no new cycle. `skills/routes.ts` uses `app.container.skills`. The conventions module imports nothing from `modules/skills/` (not even `SkillInput`); it passes an object literal. |
| Resolve the feature model | `settings/feature-models.ts` takes `deps: { db: Db }` instead of `Container` (a `Container` still fits, so `test/settings-models.it.test.ts` is unchanged) and stops importing `Container`. `container.ts` gets `featureModel(workspaceId, id)`. Its two existing `db-confined` edges are already in the baseline. |
| Validate skill fields the same way in both routes | `SkillName`, `SkillDescription`, `SkillBody` (Zod) and the limits move to `src/modules/_shared/skill-fields.ts`; `skills/constants.ts` re-exports the constants, `skills/routes.ts` imports the schemas. `_shared` imports nothing from a feature. |
| Read the repo row | the module's own `repository.ts` queries `repos` (like `repo-intel/repository.ts:136`), not the `repos` module |
| Samples, files, HEAD, model | `container.repoIntel`, `container.git`, `container.featureModel` + `container.llm`, `container.tokenizer` |

Module layout: `src/modules/conventions/{routes,service,repository,helpers,evidence,prompt,constants}.ts`, one entry in
`src/modules/index.ts`. Only `repository.ts` imports `db/schema` and `drizzle-orm`. `.claude/skills/onion-architecture/
layer-map.md` is updated (services on the container, feature-model resolver).

## UI (client)

Placement follows `frontend-architecture`; strings go through next-intl.

### Conventions page — `/repos/:repoId/conventions`

- `app/repos/[repoId]/conventions/page.tsx` — thin, `"use client"`, reads `repoId` and renders `ConventionsView`.
- Sidebar item **Conventions** (icon `ListChecks`, `g c`) in `vendor/ui/nav.ts` + a `SHORTCUTS` entry, the same way 002
  added Skills; `shell.json` already has `nav.conventions`.
- `_components/ConventionsView/`:
  - AppShell with crumbs *Skills Lab › Conventions*; an unknown repo → `RepoNotFound` (`useRepoNotFound`, as
    `app/repos/[repoId]/pulls/page.tsx:34`).
  - Header "Conventions in `<repo>`"; subtitle from the scan: `candidateCount` · N sampled files · last scan (relative
    time) · M dropped without evidence.
  - Actions: **Re-scan** (`Run extraction` before the first scan; "Scanning…" and disabled while running) and
    **Accept as Skill** (`card.acceptAsSkill`; disabled until at least one accepted convention is selected) → opens the
    modal with the **selected** accepted conventions; next to it "N of M accepted selected for the skill" (P3).
  - P3 selection: every accepted card has an **Include in skill** checkbox, all checked by default, so leaving them
    alone keeps the main flow (all accepted → `repo-conventions`). Unchecking leaves a convention out of the next skill;
    a second skill is built the same way from another subset, under another name (the modal proposes a free one).
    The selection is page state only (not stored); the server checks every id is an accepted convention of the repo.
  - States: loading skeleton; load error → `ErrorState` with retry (`page.loadError`); no scan yet → `EmptyState` with
    *Run extraction*; latest scan failed (or this session's request failed) → an alert banner `extractionFailed` with
    the page's own text for `repo_not_indexed`, `repo_intel_disabled`, `repo_not_cloned`, `repo_changed`,
    `extraction_running`, `llm_bad_output`, and the server's message for any other code (`llm_failed`,
    `config_error`, …); a succeeded scan with no candidates → a "nothing grounded" note.
  - Candidates grouped: pending, accepted, rejected (sections with counts).
  - `helpers.ts`: `groupByStatus`, `isKnownScanError`. The scan summary uses next-intl `useFormatter().relativeTime`.
- `_components/ConventionCard/` (one candidate):
  - rule (italic), **Edit** → inline textarea with Save / Cancel (`PATCH { rule }`; blank is blocked);
  - evidence header: `MonoLink` `path:Lstart-Lend` → `githubBlobUrl(full_name, commit_sha ?? default_branch, path,
    start, end)` (`client/src/lib/github-urls.ts:24`), opens GitHub at those lines in a new tab; plain text until the
    active repo has loaded;
  - snippet in a `<pre class="mono">`, rendered as text only;
  - confidence bar + percent;
  - **Accept** / **Reject**; the chosen one shows **Accepted** / **Rejected** and a click on it (Undo) returns the
    candidate to pending; accepted cards have an `--ok` left border, rejected ones are dimmed.
- `_components/CreateConventionSkillModal/`: `Modal` width 760, title "Create skill from conventions", subtitle = name; a
  banner "Merged from N accepted conventions in `<repo>`. Everything below is editable before you save."; `SkillForm`
  with `lockedType="convention"` and `hideEnabled`; footer Cancel / Create skill; 409 → `nameTaken` inline, other errors
  inline; success → toast with the skill name, modal closes. Its `helpers.ts` holds `composeSkillDraft(repo,
  conventions, takenNames)` and `freeSkillName`; `ConventionCard/helpers.ts` holds `lineRef` (`L12` / `L12-L14`).

### Shared pieces

- `SkillForm` gets a second importer, so it moves from `app/skills/_components/SkillForm/` to
  `src/components/SkillForm/` (with its helpers, styles and test) and gets an optional `lockedType` prop (type shown
  read-only). `SKILL_TYPES`, `SKILL_NAME_PATTERN`, `SKILL_DESCRIPTION_MAX`, `SKILL_BODY_MAX` move from
  `app/skills/constants.ts` to `src/lib/skill-fields.ts`; `SkillEditorModal` and `ImportSkillModal` import
  `@/components/SkillForm`.
- Hooks in `src/lib/hooks/conventions.ts` (+ barrel):
  - `useConventions(repoId, { enabled })` — key `["conventions", repoId]`, `GET`;
  - `useExtractConventions(repoId)` — `POST …/extract`, `meta: LOCAL_ERROR_TOAST` (the page shows the error); success →
    `setQueryData`, error → invalidate (the failed scan is stored);
  - `useUpdateConvention(repoId)` — `PATCH`, invalidates `["conventions", repoId]`;
  - `useCreateConventionSkill(repoId)` — `POST …/skill`, `meta: LOCAL_ERROR_TOAST` (the modal shows it), invalidates
    `["skills"]` and `["conventions", repoId]`.

### Strings

`messages/en/conventions.json` keeps its keys (`page.*`, `card.confidence`, `card.accepted`, `card.acceptAsSkill`, …) and
gets the missing ones: `card.accept`, `card.reject`, `card.rejected`, `card.undo`, `card.edit`, `card.save`,
`card.cancel`, `card.editLabel`, `card.evidence`, `card.include` (P3); `page.scanSummary`, `page.nothingGrounded`,
`page.selected` (P3), section headings, `page.errors.{repo_not_indexed, repo_intel_disabled, repo_not_cloned,
repo_changed}`; `modal.{title, merged, create, creating, created, cancel, failed}`. `SkillForm` keeps using the `skills`
namespace.

## Decisions

All 2026-11-26.

- **Code picks the files, one model call per scan** (homework requirement). The mock's two-step
  `ConventionFileSelection` dialogue is not used. Why code: the choice is deterministic and free, the model never wanders
  through the repo, and evidence is checked against exactly the bytes the model was shown.
- **Samples are spread over packages, not taken as "the top 12"** (agreed with the user after the first live run).
  repo-intel ranks can be all equal: on Brodja/dev-digest `file_rank` held one distinct rank for all 395 files, so the
  order is Postgres's tie order, which even changes with `LIMIT`. The first live scan therefore sampled only
  `server/src/server.ts` + `server/src/platform/*`; asking for 60 candidates would not help either (measured: the first
  60 under `LIMIT 600` were 56 `client` files and 4 `.claude` scripts). So code asks for 400 candidates (cheap: paths
  only) and spreads 12 over packages and their directories, keeping rank order within each group — when ranks are
  real, every package still contributes its best files. Every package's `tsconfig.json` goes into the configs first.
  Files are still picked by code; the model is still called once.
- **Degenerate output is a model failure, not an empty result.** Seen live on the second scan (deepseek-v4-flash,
  json_schema): all 12 proposals were the rule "Use \`" with the same snippet — the model closed the string right after
  a backtick. Evidence matched, so only a rule-text check catches it. The prompt now asks for plain-text rules without
  backticks, code drops fragment rules, and an all-fragment answer fails the scan (`llm_bad_output`) without replacing
  the pending candidates.
- **Code computes line numbers and stores the real lines.** The model only names a file and quotes text; it never gives
  line numbers (they are not in the prompt either).
- **Rejected as an extra flag** (agreed with the user): `rejected boolean` + CHECK, `accepted` kept as is, `status`
  derived in the API. One additive migration, the starter contract only grows.
- **`convention_scans` table** (agreed with the user): without it "never scanned" and "scanned, nothing grounded" look the
  same, a failure disappears on reload, and the "dropped without evidence" count — the visible proof that code filters
  candidates — has nowhere to live.
- **Several skills from one list — via selection** (P3, agreed with the user): the user picks a subset of the accepted
  candidates for each skill. No categories from the model.
- **Synchronous extract.** One call to a cheap model; a job queue and polling are not worth it. Timeout 150 s.
- **Links pin `commit_sha`**, the HEAD read around the scan, so lines stay right after the branch moves on; the default
  branch is the fallback for rows without a sha.
- **Draft built on the client, ids checked on the server.** The draft is plain text the user edits anyway; the server
  guarantees that only accepted conventions of this repo are referenced.
- **No code snippets in the skill body** — trusted source; see "Skill from conventions".
- **Re-scan replaces pending only.** Accepted and rejected candidates are the user's work and survive; the model is told
  about them and code drops duplicates.
- **Repo files are untrusted input** — wrapped with `wrapUntrusted` and a guard sentence; paths from the model are never
  used to read the disk.

## Out of scope

- API Contract Reviewer (agent, its four skills, the import, the with / without skills experiment) — built through the UI
  from 002; the result goes into the PR description.
- Grouping conventions into skills by category; `evidence_files` on the skill (`create()` does not write it today).
- Background jobs, progress streaming, cancelling a scan.
- Languages beyond what repo-intel ranks (`.ts .tsx .js .jsx .mjs .cjs`).
- e2e flows; the homework's stretch items (import from URL, Claude Code plugin, better sampling).

## Done when

- **P1.** Run extraction on the Conventions page lists the grounded candidates. Each can be accepted or rejected. A skill
  created from the accepted ones contains them and not the rejected ones. The skill can be linked to an agent, and a
  review with it shows it in the trace's skills block.
- **P2.** Every candidate shows file:lines and the real snippet; the link opens GitHub at those lines. Ungrounded
  candidates are dropped by code (counted on the scan). Files come from `getConventionSamples` + configs; one model call
  per scan. Rule text and the skill's name, description and body are editable before saving. The skill is saved with
  type `convention` and source `extracted`.
- **P3.** Several skills can be built from different selections. Re-scan does not duplicate accepted conventions and does
  not bring back rejected ones. Empty state until the first scan, a clear error when a scan fails (also after reload).
  Strings come from `conventions.json`.
- `pnpm test` + `pnpm typecheck` pass in server and client; the onion-architecture gate reports 0 errors and 20 warnings.
- Tests: see each part below.

## Implementation plan

Four parts, in this order. Parts 1 and 2 are the homework's P1/P2; part 3 is P3; part 4 is the hand-in.

### Part 1 — server

1. **Boundaries, no behaviour change:** `SkillsDeps` + `container.skills` (+ `skills/routes.ts` uses it);
   `feature-models.ts` takes `deps: { db: Db }` + `container.featureModel`; `src/modules/_shared/skill-fields.ts`.
   Check: gate still 0 / 20, `pnpm typecheck`, `skills*.it`, `agent-skills.it`, `settings-models.it`.
2. **Data and contracts:** schema + migration (read the SQL) + `db/rows.ts`; contracts in `knowledge.ts`, mirrored into
   `client/src/vendor/shared`.
3. **Module:** `constants.ts` (config names, limits), `evidence.ts`, `helpers.ts` (path normalisation, probe dirs,
   prepare / truncate, dedupe, DTO mappers, status ↔ flags), `prompt.ts` (schema + messages), `repository.ts` (repo
   lookup, list, latest scan, decided rules, `replacePending`, `recordFailedScan`, `update` with the empty-SET guard from
   `SkillsRepository.update`, `acceptedIds`), `service.ts`, `routes.ts`; entry in `src/modules/index.ts`.
4. **Docs:** `server/README.md` (API map), `layer-map.md`.

Tests (mock LLM, no network):

- `test/conventions-evidence.test.ts` — CRLF file vs LF snippet; tabs vs spaces; BOM and NFC; first of several
  occurrences; a partial line expands to whole lines; empty / too short snippet rejected; over 40 lines rejected; a
  snippet past the truncation point rejected; fences stripped; correct lines at the start and the end of a file; stored
  snippet = the file's lines.
- `test/conventions-helpers.test.ts` — path normalisation (`./`, `\`; other case → no match); probe dirs for a monorepo,
  every package's tsconfig first; `spreadSamples` over packages and directories with tied ranks (dot-dirs skipped,
  dedupe, fewer candidates than 12); truncation keeps line numbers; dedupe (equal, Jaccard, same place); confidence
  clamp; cap at 15.
- `test/conventions-prompt.test.ts` — every file wrapped untrusted with a sanitised label; no line numbers; decided rules
  listed (capped); the JSON schema has no optional fields.
- `test/conventions-service.test.ts` (stubs as in `test/repo-intel-resync.test.ts`) — `getConventionSamples(repoId, 400)`
  is called; with one package ranked first the 12 samples still come from every package and each package's tsconfig
  is sent; exactly one `completeStructured` with `schemaName: 'ConventionExtraction'` and the feature model's model;
  no samples → 409 and no model call; model error → 502 and a failed scan; `repo_changed` when HEAD moves.
- `test/conventions.it.test.ts` (Docker; `buildApp` with `MockLLMProvider('openai', { structuredBySchema:
  { ConventionExtraction } })`, `MockGitClient({ files, head })`, a `repoIntel` override; the seed repo gets a
  `clone_path`):
  1. GET before any scan → `{ scan: null, candidates: [] }`.
  2. Extract → one call, model `gpt-5.4`; dropped: unknown file, snippet not in the file, a file outside the sample set;
     lines from code; `commit_sha` = head; scan counters right.
  3. A Settings override of the conventions model is used in the call.
  4. PATCH accept / reject / edit; another workspace's id → 404; empty body → 422.
  5. Re-scan → accepted and rejected unchanged, pending replaced, a re-proposed accepted rule not duplicated, a rejected
     one not back.
  6. Model failure → 502, GET shows the failed scan, nothing deleted.
  7. Skill → 201, `source: 'extracted'`, `type: 'convention'`, `trusted: true`; a pending or rejected id → 422; a taken
     name → 409.
  8. The skill linked to an agent (`PUT /agents/:id/skills`) → review → poll the trace until 200 → `config.skills` has
     `repo-conventions` (trusted) and the prompt has its rules without `<untrusted` (pattern of
     `test/skills-in-prompt.it.test.ts`).

Check: `pnpm exec vitest run --exclude '**/*.it.test.ts'` (compare with the Windows baseline in `server/INSIGHTS.md` —
8 known POSIX failures), `pnpm exec vitest run .it.test`, `pnpm typecheck`, the gate
`pnpm exec depcruise src ../reviewer-core/src --config ../.claude/skills/onion-architecture/depcruise.config.cjs`.

### Part 2 — client

1. Mirror the contracts; `src/lib/skill-fields.ts`; move `SkillForm` to `src/components/` (+ `lockedType`), update the
   `/skills` imports and the moved test.
2. `src/lib/hooks/conventions.ts` + barrel.
3. Route, `ConventionsView`, `ConventionCard`, `CreateConventionSkillModal`; the nav item; strings; `client/README.md`
   (route map).

Tests (Vitest + RTL; `vi.mock` for `@/lib/hooks/conventions`, `@/lib/repo-context`, `@/components/app-shell`; wrapper
`NextIntlClientProvider` with `{ conventions, skills }` + `ToastProvider`, as in `SkillsView.test.tsx`):

- `ConventionsView.test.tsx` — empty state → *Run extraction* calls extract; "Scanning…" with disabled buttons; load
  error + Retry; failed-scan banner with the stored message; `repo_not_indexed` text; subtitle; *Accept as Skill*
  disabled with nothing accepted, otherwise the modal opens with the accepted rules only; `RepoNotFound`.
- `ConventionCard.test.tsx` — link href `…/blob/<sha>/<path>#L12-L14`; Accept / Reject send `status`; edit sends
  `{ rule }`, blank blocked, Cancel restores; a `<img onerror>` snippet renders as text; badges and Undo.
- `CreateConventionSkillModal.test.tsx` — prefilled fields, type read-only; payload has `convention_ids`; 409 inline;
  blank body blocked; success → toast and close; Cancel sends nothing.
- `CreateConventionSkillModal/helpers.test.ts` — the draft has only the given (accepted) rules, in order, with
  references, without snippets; `ConventionsView/helpers.test.ts` — grouping by status, known error codes;
  free name when `repo-conventions` is taken.
- Moved `SkillForm.test.tsx` (+ `lockedType`); the `/skills` tests stay green.

Check: `pnpm test`, `pnpm typecheck`; open the page in a real browser — a value import from `@devdigest/shared` breaks
only the Next dev server, not tests.

### Part 3 — P3: several skills

An "Include in skill" checkbox on accepted cards (all selected by default), "N of M selected" next to *Accept as Skill*,
the modal built from the selection, a free default name. The server already takes any subset of `convention_ids`.
Tests: the selection changes the draft and the payload; two skills in a row.

### Part 4 — check and hand-in

Live run on the user's cloned repo (indexed by repo-intel; feature model `conventions` set to a cheap model in Settings,
e.g. openrouter `deepseek/deepseek-v4-flash` — not anthropic `claude-haiku-5-5`, which rejects the temperature the
adapter always sends): extract → click evidence links → accept 2, reject 1, edit one → re-scan without duplicates →
create the skill → link it to General Reviewer → open the PR page (so the diff is loaded) → review → trace with
`repo-conventions` and its tokens. Then `/pr-self-review`, `/engineering-insights` (files, tokens, cost, kept / dropped),
and the PR into the fork's `main` with the 1–3 minute video following the homework's script.
