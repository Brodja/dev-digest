---
name: response-schema
description: ALWAYS flag a response that does not match its declared schema or shared contract — a missing or extra field, camelCase in snake_case JSON, null where the type promises a value, or a contract changed on only one side (server vs client copy). Do not ask for schemas on internal helpers.
---
- The DTO mapper must return exactly the zod contract's fields, snake_case.
- A field added to a never-migrated jsonb document must be `.nullish()`.
- A shared contract change needs the client copy updated in the same PR.

Bad — the contract says `cost_usd`, the mapper leaks a camelCase field:
```ts
return { ...row, costUsd: row.costUsd };
```
Good:
```ts
return { id: row.id, cost_usd: row.costUsd ?? null };
```
