---
name: breaking-change
description: ALWAYS flag a change that breaks an existing API consumer — a removed or renamed route or field, a narrowed type, a new required input, a changed status or error code. Do not flag purely additive changes (new endpoints, new optional fields).
---
- Compare old vs new shape for every changed route, DTO and shared contract.
- Name the consumer that breaks (client hook, CI runner, integration).
- Fix: keep the old field/route alongside the new one, or version it.

Bad — renames a field every client reads:
```ts
return { headSha: pr.headSha }; // was head_sha
```
Good — additive, old field kept:
```ts
return { head_sha: pr.headSha, base_sha: pr.baseSha };
```
