import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { FflateArchiveReader, normalizeEntryPath } from '../src/adapters/archive/fflate.js';

/** The fflate ArchiveReader (skill import) on archives built in memory. */
const reader = new FflateArchiveReader();

const zip = (files: Record<string, string | Uint8Array>) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v]),
    ),
  );

describe('FflateArchiveReader', () => {
  it('lists file entries with their declared sizes, directories excluded', () => {
    const bytes = zip({
      'my-skill/SKILL.md': '# Skill',
      'my-skill/scripts/run.sh': 'echo hi',
      'my-skill/empty/': new Uint8Array(),
    });
    expect(reader.entries(bytes)).toEqual([
      { path: 'my-skill/SKILL.md', uncompressedSize: 7 },
      { path: 'my-skill/scripts/run.sh', uncompressedSize: 7 },
    ]);
  });

  it('reads one entry', () => {
    const bytes = zip({ 'SKILL.md': '# Skill\nrules', 'other.md': 'x' });
    const res = reader.read(bytes, 'SKILL.md', 1024);
    expect(res.ok && new TextDecoder().decode(res.bytes)).toBe('# Skill\nrules');
  });

  it('refuses an entry whose declared size is over the limit (no inflate)', () => {
    // 300 KB of one letter deflates to a few hundred bytes — a tiny zip-bomb.
    const bytes = zip({ 'SKILL.md': 'a'.repeat(300 * 1024) });
    expect(bytes.length).toBeLessThan(5_000);
    expect(reader.entries(bytes)[0]!.uncompressedSize).toBe(300 * 1024);
    expect(reader.read(bytes, 'SKILL.md', 256 * 1024)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('reports a missing entry and throws on bytes that are not a zip', () => {
    expect(reader.read(zip({ 'a.md': 'x' }), 'SKILL.md', 1024)).toEqual({ ok: false, reason: 'missing' });
    expect(() => reader.entries(strToU8('definitely not a zip archive'))).toThrow();
  });

  it('normalizes Windows separators and a leading ./ in entry names', () => {
    expect(normalizeEntryPath('.\\my-skill\\SKILL.md')).toBe('my-skill/SKILL.md');
    expect(normalizeEntryPath('./SKILL.md')).toBe('SKILL.md');
  });
});
