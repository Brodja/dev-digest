---
name: over-mocking
description: ALWAYS flag a test that mocks the unit under test or the pure logic it should exercise, asserts mock calls instead of the result, or mocks the database in an integration test. Do not flag mocks of real external I/O (network, LLM, clock, filesystem).
---
- Mock at the boundary (adapters), run the real logic, assert the output.
- A test whose only assertion is "the mock was called" proves nothing.

Bad — the parser under test is mocked:
```ts
vi.mock('./import-parser', () => ({ pickSkillEntry: () => 'SKILL.md' }));
expect(pickSkillEntry).toHaveBeenCalled();
```
Good:
```ts
expect(pickSkillEntry([{ path: 'a/SKILL.md', uncompressedSize: 9 }])).toBe('a/SKILL.md');
```
