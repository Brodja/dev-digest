import { describe, it, expect } from 'vitest';
import {
  cleanSnippet,
  locateSnippet,
  nonWhitespaceLength,
  prepareSource,
} from '../src/modules/conventions/evidence.js';

/**
 * Evidence is checked by code (server/specs/003-conventions.md → Evidence check):
 * the snippet must be in the exact text the model saw; lines come from the match.
 */

const LINES = [
  "import { z } from 'zod';", // 1
  '', // 2
  'export const Finding = z.object({', // 3
  '\tid: z.string(),', // 4 (tab)
  '  severity: Severity,   ', // 5 (trailing spaces)
  '});', // 6
  'export type Finding = z.infer<typeof Finding>;', // 7
];
const FILE = prepareSource(LINES.join('\r\n'));

describe('prepareSource', () => {
  it('normalises CRLF / CR, drops a BOM and composes to NFC', () => {
    expect(prepareSource('﻿a\r\nb\rc')).toBe('a\nb\nc');
    expect(prepareSource('café')).toBe('café');
  });
});

describe('locateSnippet', () => {
  it('finds an LF snippet in a CRLF file, across a tab vs spaces difference', () => {
    const m = locateSnippet(FILE, 'export const Finding = z.object({\n  id: z.string(),');
    expect(m).toEqual({
      startLine: 3,
      endLine: 4,
      snippet: 'export const Finding = z.object({\n\tid: z.string(),',
    });
  });

  it('stores the file’s real lines (trailing whitespace trimmed), not the model’s text', () => {
    const m = locateSnippet(FILE, 'id:   z.string(),   severity:  Severity,');
    expect(m?.snippet).toBe('\tid: z.string(),\n  severity: Severity,');
    expect([m?.startLine, m?.endLine]).toEqual([4, 5]);
  });

  it('matches across a BOM and decomposed Unicode', () => {
    const file = prepareSource('﻿const greeting = "café au lait";\n');
    expect(locateSnippet(file, 'const greeting = "café au lait";')?.startLine).toBe(1);
  });

  it('expands a partial-line match to whole lines', () => {
    const m = locateSnippet(FILE, 'z.infer<typeof Finding>');
    expect(m).toEqual({ startLine: 7, endLine: 7, snippet: LINES[6] });
  });

  it('takes the first of several occurrences', () => {
    const block = ['export function handler(req) {', '  return service.run(req);', '}'];
    const file = prepareSource(['// a', ...block, '// b', ...block].join('\n'));
    const m = locateSnippet(file, block.join('\n'));
    expect([m?.startLine, m?.endLine]).toEqual([2, 4]);
  });

  it('finds lines at the very start and the very end of a file', () => {
    expect(locateSnippet(FILE, "import { z } from 'zod';")?.startLine).toBe(1);
    expect(locateSnippet(FILE, 'export type Finding = z.infer<typeof Finding>;')?.endLine).toBe(7);
  });

  it('rejects an empty, whitespace-only or too short snippet', () => {
    expect(locateSnippet(FILE, '')).toBeNull();
    expect(locateSnippet(FILE, '   \n  ')).toBeNull();
    expect(locateSnippet(FILE, '});')).toBeNull();
  });

  it('rejects text that is not in the file, including an elided "..." quote', () => {
    expect(locateSnippet(FILE, 'export const Review = z.object({')).toBeNull();
    expect(locateSnippet(FILE, 'export const Finding = z.object({ ... });')).toBeNull();
  });

  it('rejects a match spanning more than 40 lines', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `const value${i} = compute(${i});`);
    const file = lines.join('\n');
    expect(locateSnippet(file, lines.slice(0, 41).join('\n'))).toBeNull();
    expect(locateSnippet(file, lines.slice(0, 40).join('\n'))?.endLine).toBe(40);
  });

  it('strips a surrounding code fence', () => {
    const m = locateSnippet(FILE, '```ts\nexport const Finding = z.object({\n```');
    expect(m?.startLine).toBe(3);
  });

  it('falls back to a whitespace-free match for long snippets (foo(a,b) vs foo(a, b))', () => {
    const file = 'const total = sumValues(alpha,beta,gamma);';
    expect(locateSnippet(file, 'const total = sumValues(alpha, beta, gamma);')?.startLine).toBe(1);
  });

  it('retries once with literal \\n unescaped', () => {
    const m = locateSnippet(FILE, 'export const Finding = z.object({\\n  id: z.string(),');
    expect([m?.startLine, m?.endLine]).toEqual([3, 4]);
  });
});

describe('snippet helpers', () => {
  it('counts non-whitespace characters', () => {
    expect(nonWhitespaceLength(' a b\n\tc ')).toBe(3);
  });
  it('cleans fences with or without a language tag', () => {
    expect(cleanSnippet('```\nx = 1\n```')).toBe('x = 1');
    expect(cleanSnippet('  plain  ')).toBe('plain');
  });
});
