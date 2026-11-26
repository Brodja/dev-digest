---
name: uncovered-branches
description: ALWAYS flag a new or changed branch in the diff — a condition, early return, catch, error status or validation rule — that no test in the diff exercises. Do not ask for tests of trivial getters, re-exports or pure wiring.
---
- Cite the untested branch line, not a test file.
- Name the test to add: its input and the outcome it asserts.

Bad — new 409 path, only the happy path is tested:
```ts
if (await repo.nameTaken(ws, name)) throw skillNameTakenError(name);
```
Good — a test that hits it:
```ts
expect((await create({ name: 'taken' })).statusCode).toBe(409);
```
