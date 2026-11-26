# 003 — Conventions Extractor

Conventions page (`/repos/:repoId/conventions`: run extraction / re-scan, candidate cards with GitHub evidence links,
accept / reject / edit, empty and error states), the "Accept as Skill" modal that builds `repo-conventions` from the
accepted candidates (several skills from different selections), the sidebar item, and `SkillForm` moving to
`src/components/` for its second importer.
The spec lives with the core change: [server/specs/003-conventions.md](../../server/specs/003-conventions.md).
