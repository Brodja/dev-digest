# 004 — Skills Lab design pass

The Skills and Conventions pages from 002 and 003 work but do not look like the design
(`screen_skills.jsx`, `screen_conv_conf.jsx`, `screen_agents.jsx`, `chrome.jsx`, `screen_trace.jsx` of the course
design bundle). This pass rebuilds their UI after the design and the lecturer's reference branches
(`upstream/lesson-2-lab/skills`, `upstream/lesson-3-lab/intent-layer-start|finish`, `upstream/reference/full-build`),
adds a skill page `/skills/[id]` with Config / Preview / Versions / Stats, and the three server routes it needs.
Homework L02, 2026-11-27. Spans client + server; this file is the spec, `server/specs/004-skills-lab-design.md` links here.

## Not changing

- The conventions extractor (003): file sampling by code, one model call, evidence checked by code, `convention_scans`,
  `rejected` + CHECK, `commit_sha` in links, the `llm_bad_output` guard, English rules. The only server change in that
  module is the optional `enabled` of `POST /repos/:id/conventions/skill`.
- A skill built from conventions has no code snippets: `extracted` is trusted, so repository code in its body would reach
  the prompt without the `<untrusted>` wrapper (003, "Skill from conventions"). The design shows snippets in the body;
  we keep the rule and say so under the body field.
- Skill trust by `source`, the `<untrusted>` wrapper and guard sentence, the Skills block of Prompt assembly, the order
  of skills in the prompt and `PUT /agents/:id/skills`.
- L01 features (run cost, severity filter). Tabs and menu items of later lessons (Context, Evals, Stats and CI of an
  agent, Eval Dashboard, Memory, …) are not added.

## Decisions (agreed with the user, 2026-11-27)

1. **Menu:** `WORKSPACE` — Pull Requests; `SKILLS LAB` — Skills, Agents, Conventions (`chrome.jsx`,
   `intent-layer-finish`). Shortcuts `g p / g a / g s / g c` stay.
2. **`/skills` is master/detail.** The left column (skill list) is on `/skills` and `/skills/[id]`; `/skills` shows a
   placeholder on the right. Create and import open the new skill's page.
3. **Skill page tabs:** Config, Preview, Versions, Stats (`?tab=`). The Config tab stays mounted while hidden, so unsaved
   edits survive a tab switch.
4. **Versions** come from `skill_versions` (body only — no migration, no version note). Restore copies an old body into a
   new version; name, description and type are not versioned (unchanged from 002).
5. **Stats** = the agents that link the skill and the version count; pull frequency and accept rate were added later
   from the run traces (decision 14). No findings-by-category chart.
6. **Agent Skills tab** lists every workspace skill: linked ones first in prompt order, then the rest by name. The
   checkbox links / unlinks (as in `full-build`); the per-link switch and × go. The link's `enabled` stays in the API.
   A legacy link with `enabled = false` shows unchecked (it never reaches the prompt) and is dropped by the next save
   from this tab. Reorder: drag-and-drop, or ArrowUp / ArrowDown on the focused grip; off while the filter is used.
7. **Conventions P3:** the accepted set is the skill. The "Include in skill" checkbox goes; a second skill is built after
   changing the accepted set, and the modal proposes a free name (`repo-conventions-2`). *Select all* accepts every
   pending candidate (rejected ones stay rejected); *Deselect all* moves accepted ones back to pending.
8. **One list of candidates** in an order that ignores the status (confidence, then age, rule, id — the server's keys
   minus the status, which it sorts first for the old sections), so a decision never moves a card. A rejected card
   stays in place, dimmed, its button reads *Rejected* (click = undo), as the homework asks for a visible Rejected mark.
9. **Route** stays `/repos/:repoId/conventions` (the menu item fills in the active repo).
10. **Enabled in the conventions modal** → optional `enabled` (default `true`) in `POST /repos/:id/conventions/skill`.
11. **`CodeEditor`** (line numbers, `<name>.md` header, *unsaved*, token estimate) joins `@devdigest/ui`; `SkillForm`
    uses it for the body.
12. After *Create skill* on the Conventions page the user stays there (toast with the name) — handy for P3.
13. **Skill card** (added 2026-11-27, after the design's SkillCard and the reference build's SkillListItem): a delete
    button next to the switch (confirm "Delete skill "<name>"? This cannot be undone.", the card does not open,
    a spinner while it runs; deleting the open skill goes back to `/skills`), "<Source> · v<version>" under the
    description, and the usage row "N agents · X% pull freq · Y% accept" (accept green from 60%, amber below).
14. **Card and Stats numbers are honest, no migration:** *N agents* = agents of the workspace that link the skill, any
    link state; *pull freq* = runs of the workspace with a trace whose `config.skills` holds the skill / all runs with
    a trace; *accept* = accepted / (accepted + dismissed) findings of those runs (via `reviews.run_id`). No runs or no
    decided findings → "—" (null), never a made-up 0%. `GET /skills` returns them per item (`SkillListItem`:
    `used_by_count`, `pull_rate`, `accept_rate`) from one aggregate query; `GET /skills/:id/stats` adds the same two
    rates, shown as PULL FREQUENCY and ACCEPT RATE.

## Server

Contracts in `server/src/vendor/shared/contracts/knowledge.ts`, mirrored into the client copy:

```ts
SkillVersion = { skill_id: uuid, version: int > 0, body: string, created_at: string }
SkillUsage   = { agent_id: uuid, agent_name, agent_enabled: bool, link_enabled: bool,
                 position: int > 0,      // place among the agent's links, by link order
                 in_prompt: bool }       // link_enabled && skill.enabled — the run's rule
SkillStats   = { skill_id, version, version_count, used_by_count, in_prompt_count, agents: SkillUsage[] }
```

| Route | Body | Response |
|---|---|---|
| `GET /skills/:id/versions` | — | `SkillVersion[]`, newest first |
| `POST /skills/:id/restore` | `{ version: int > 0 }` | `Skill`: the old body becomes version N+1; the same body as now → unchanged, no new version |
| `GET /skills/:id/stats` | — | `SkillStats`, agents by name |
| `POST /repos/:id/conventions/skill` | + `enabled?: boolean` (default `true`) | unchanged |

Workspace-scoped: another workspace's skill → 404; an unknown version → 404; a non-uuid id or a bad version → 422.
Layers: `routes.ts` → `service.ts` → `repository.ts`. Restore runs in one transaction with the skill row locked
(`FOR UPDATE`), through the same patch path as `update`, so the version bump and the snapshot cannot drift. No new
adapter, migration or cross-module import; the gate stays at 0 errors / 20 warnings.

## Client

| Screen | Design | Now | After |
|---|---|---|---|
| Menu | two groups | one group | two groups |
| `/skills` | list column + tabbed editor | card grid + side drawer + edit modal | `SkillsSidebar` (header, *Add Skill ▾*: Create from scratch / Import from file, search, cards) + placeholder |
| `/skills/[id]` | header + Config / Context / Preview / Evals / Stats / Versions | — | header (type icon, mono name, type chip, `vN`, source / untrusted / disabled) + Config / Preview / Versions / Stats |
| Config | Configuration, `vN`, Enabled; Name, Description, Type, body in a code editor; Save / Cancel; "Saving snapshots the body as vN+1"; Delete zone | edit modal, delete in drawer | as designed; Save sends changed fields only; 409 → name taken; Delete asks, then opens `/skills` |
| Preview | rendered markdown in a card | drawer | as designed + the untrusted notice |
| Versions | history, Current, Diff, Restore | — | vN, date, ~tokens, Current; Diff = line diff (LCS) against the previous version; Restore asks first, hidden when the body equals the current one |
| Stats | used by, pull, accept, findings, agents | "used by" in drawer | Used by, In prompt, Versions; agents with `#N in prompt` and link / agent / skill state, *Open* → `/agents/:id?tab=skills` |
| Agent Skills tab | all skills, grip, checkbox, type chip, filter, "N of M enabled" | linked only, ↑/↓, switch, ×, add select | decision 6; N = linked and globally enabled, M = all skills |
| Conventions | one list; Accept all / Deselect all; N of M accepted; Create skill | three sections, Include checkbox | decisions 7–8; rule edited by a click on its text; Copy snippet; 3 skeletons; "Scanning repository…" row |
| Conventions modal | Name, Description, Type, Enabled, body editor, "Saved as v1 · added to Skills Lab" | no Enabled, no footer note | as designed; type read-only `convention`; hint under the body that code stays out |
| Trace | Configuration → *Skills loaded* chips | — | chips of `config.skills[].name` (title `vN`), "none" for old traces |

## Done when

- The menu has the two groups; the shortcuts still work.
- `/skills` lists skills on the left; a card opens `/skills/:id`; each of the four tabs works against the API: editing the
  body and saving adds a version, Diff shows the change, Restore adds a version with the old body, Stats lists the
  linking agents, Delete removes the skill.
- The agent Skills tab lists every skill; the checkbox links and unlinks; drag and arrow keys reorder; the filter works.
- The Conventions page matches decisions 7–9; the modal sends `enabled`; a second skill from another accepted set gets a
  free name.
- The trace shows *Skills loaded*.
- `pnpm test` + `pnpm typecheck` pass in server and client; the gate reports 0 errors and 20 warnings.

## Tests

- Server: `test/skill-history.it.test.ts` (versions newest first; a metadata-only edit adds none; restore → N+1 with the
  old body; restore of the current body adds none; unknown version 404; another workspace 404; bad id / version 422;
  stats with two agents, one link off, positions, an unlinked skill); `test/skills-helpers.test.ts` (DTO mappers,
  `in_prompt`); `test/conventions.it.test.ts` (`enabled: false` → disabled skill, omitted → enabled).
- Client (Vitest + RTL, hooks mocked): `CodeEditor`, `SkillsSidebar`, `SkillCard`, `SkillEditor` (tab switch keeps
  Config edits), `ConfigTab`, `PreviewTab`, `VersionsTab` + `lineDiff`, `StatsTab`, `CreateSkillModal`, `SkillsTab` +
  helpers, `ConventionsView` (one list, Select / Deselect all, two skills from two accepted sets), `ConventionCard`,
  `CreateConventionSkillModal`, `RunTraceDrawer`.
- Manual run in a browser (value imports from `@devdigest/shared` break only the Next dev server).
