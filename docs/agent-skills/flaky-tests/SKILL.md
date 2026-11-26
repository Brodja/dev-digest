---
name: flaky-tests
description: ALWAYS flag a test that depends on real time, sleeps, unseeded randomness, test order, shared mutable state, real network or unawaited async — including asserting on fire-and-forget work without waiting for it. Do not flag fake timers or seeded randomness.
---
- Wait for a condition (poll / `waitFor`), never for a fixed delay.
- Each test sets up and cleans its own state.

Bad — races the background run:
```ts
await app.inject({ method: 'POST', url: `/pulls/${id}/review`, payload });
await new Promise((r) => setTimeout(r, 500));
```
Good:
```ts
await waitForPrRuns(db, id, { expected: 1 });
```
