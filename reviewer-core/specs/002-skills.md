# 002 — Skills

`SkillBlock` + `renderSkillBlock`: skills reach `## Skills / rules` as name + description + body, untrusted (imported) skills
inside `wrapUntrusted('skill:<name>', …)`, plus a guard clause that is added only when an untrusted skill is present.
The spec lives with the core change: [server/specs/002-skills.md](../../server/specs/002-skills.md).
