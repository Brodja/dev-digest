# Agent skills

Review skills in the `SKILL.md` format (frontmatter `name` + a directive
`description`, then a short markdown body). In DevDigest a skill is stored in the DB
and linked to agents; every linked, enabled skill is sent in every run of that
agent, so keep them short. Spec: [server/specs/002-skills.md](../../server/specs/002-skills.md).

| Skill | Agent | How it got into the DB |
|---|---|---|
| [breaking-change](./breaking-change/SKILL.md) | API Contract Reviewer | `POST /skills` (manual) |
| [response-schema](./response-schema/SKILL.md) | API Contract Reviewer | `POST /skills` (manual) |
| [semver-discipline](./semver-discipline/SKILL.md) | API Contract Reviewer | `POST /skills` (manual) |
| [deprecation-policy](./deprecation-policy/SKILL.md) | API Contract Reviewer | imported in the UI (untrusted) |
| [uncovered-branches](./uncovered-branches/SKILL.md) | Test Quality Reviewer | `POST /skills` (manual) |
| [missing-edge-cases](./missing-edge-cases/SKILL.md) | Test Quality Reviewer | `POST /skills` (manual) |
| [over-mocking](./over-mocking/SKILL.md) | Test Quality Reviewer | `POST /skills` (manual) |
| [flaky-tests](./flaky-tests/SKILL.md) | Test Quality Reviewer | `POST /skills` (manual) |

The agents' system prompts: [api-contract-reviewer.md](../agent-prompts/api-contract-reviewer.md),
[test-quality-reviewer.md](../agent-prompts/test-quality-reviewer.md).
With vs without skills on two demo PRs: [EXPERIMENT.md](./EXPERIMENT.md).
As with prompts, the DB is the source of truth at run time: after editing a file here,
update the skill (`PUT /skills/:id`, a changed body becomes a new version).
