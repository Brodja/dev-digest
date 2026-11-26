---
name: missing-edge-cases
description: ALWAYS flag tests of changed logic that cover only the happy path when the code handles empty, null, boundary (0, 1, limit, limit + 1), duplicate or invalid input. Do not list edge cases the code can never receive.
---
- Check the inputs the changed code branches on; each needs one case.
- Boundaries: empty list, exactly the limit, one past it.

Bad — one ordinary case:
```ts
expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
```
Good — also the edges:
```ts
expect(moveItem([], 0, 0)).toEqual([]);
expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']); // out of range
```
