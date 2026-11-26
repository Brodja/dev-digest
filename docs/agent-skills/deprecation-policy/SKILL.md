---
name: deprecation-policy
description: ALWAYS flag removing or changing a public field, route or error code that was not deprecated first — no deprecation marker, no documented replacement, no sunset date. Do not flag removing something that was already deprecated for a full release cycle.
---
- Deprecate first: mark it (`@deprecated`, `Deprecation` header or docs), name the
  replacement and the removal date; keep it working until then.
- Removal comes in a later release, after the sunset date.

Bad — gone in one step:
```ts
// app.get('/pulls/:id/brief', …)  deleted
```
Good:
```ts
/** @deprecated since 1.6 — use GET /pulls/:id/overview; removed in 2.0 (2027-03-01). */
app.get('/pulls/:id/brief', handler);
```
