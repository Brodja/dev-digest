---
name: semver-discipline
description: ALWAYS flag a breaking contract change shipped without a major version bump or a versioned path, and a version bump that does not match the change (major for a fix, patch for a break). Do not demand a bump for internal refactors with no contract change.
---
- Breaking → MAJOR (or `/v2/` route); additive → MINOR; fix only → PATCH.
- The bump, the changelog line and the change must land in the same PR.

Bad — field removed, version says "fix":
```json
{ "version": "1.4.1" }
```
Good:
```json
{ "version": "2.0.0" }
```
plus `CHANGELOG: BREAKING — removed reviews[].model; use agent.model`.
