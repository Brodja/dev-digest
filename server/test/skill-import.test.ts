import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import {
  buildPreview,
  classifyIgnored,
  decodeUtf8,
  detectKind,
  parseSkillFile,
  pickSkillEntry,
  slugify,
} from '../src/modules/skills/import-parser.js';
import type { AppError } from '../src/platform/errors.js';

/** Skill import parsing (server/specs/002-skills.md "Import") — pure, no DB. */

const reasonOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (err) {
    const e = err as AppError;
    expect(e.statusCode).toBe(422);
    expect(e.code).toBe('import_invalid');
    return (e.details as { reason: string }).reason;
  }
  return undefined;
};

const entries = (...paths: string[]) => paths.map((path) => ({ path, uncompressedSize: 10 }));

describe('detectKind', () => {
  const zipBytes = zipSync({ 'SKILL.md': strToU8('x') });

  it('accepts .md text and .zip / .skill archives', () => {
    expect(detectKind('SKILL.md', strToU8('# hi'))).toBe('markdown');
    expect(detectKind('rules.markdown', strToU8('# hi'))).toBe('markdown');
    expect(detectKind('skill.zip', zipBytes)).toBe('archive');
    expect(detectKind('owasp.skill', zipBytes)).toBe('archive');
  });

  it('refuses a mismatch between extension and content, or another type', () => {
    expect(reasonOf(() => detectKind('fake.zip', strToU8('# not a zip')))).toBe('unsupported_file');
    expect(reasonOf(() => detectKind('sneaky.md', zipBytes))).toBe('unsupported_file');
    expect(reasonOf(() => detectKind('run.sh', strToU8('echo')))).toBe('unsupported_file');
  });
});

describe('decodeUtf8', () => {
  it('drops a BOM and normalizes line endings', () => {
    expect(decodeUtf8(new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8('a\r\nb\rc')]))).toBe('a\nb\nc');
  });

  it('refuses invalid UTF-8', () => {
    expect(reasonOf(() => decodeUtf8(new Uint8Array([0x41, 0xff, 0xfe, 0x42])))).toBe('not_utf8');
  });
});

describe('pickSkillEntry', () => {
  it('takes the SKILL.md closest to the root, any case', () => {
    expect(pickSkillEntry(entries('SKILL.md', 'scripts/a.py'))).toBe('SKILL.md');
    expect(pickSkillEntry(entries('my-skill/skill.MD', 'my-skill/references/api.md'))).toBe('my-skill/skill.MD');
    expect(pickSkillEntry(entries('top/SKILL.md', 'top/nested/deep/SKILL.md'))).toBe('top/SKILL.md');
  });

  it('refuses an archive with none, or several at the same depth', () => {
    expect(reasonOf(() => pickSkillEntry(entries('README.md', 'a.py')))).toBe('no_skill_md');
    expect(reasonOf(() => pickSkillEntry(entries('a/SKILL.md', 'b/SKILL.md')))).toBe('multiple_skill_md');
  });
});

describe('classifyIgnored', () => {
  it('lists every other entry; scripts by folder or extension', () => {
    const list = classifyIgnored(
      entries('s/SKILL.md', 's/scripts/check', 's/tool.py', 's/run.ps1', 's/bin/x.exe', 's/references/api.md', 's/logo.png'),
      's/SKILL.md',
    );
    expect(list).toEqual([
      { path: 's/scripts/check', reason: 'script' },
      { path: 's/tool.py', reason: 'script' },
      { path: 's/run.ps1', reason: 'script' },
      { path: 's/bin/x.exe', reason: 'script' },
      { path: 's/references/api.md', reason: 'other' },
      { path: 's/logo.png', reason: 'other' },
    ]);
  });
});

describe('parseSkillFile (frontmatter)', () => {
  it('reads name / description / type, plain and quoted, and lists other keys', () => {
    const parsed = parseSkillFile(
      [
        '---',
        'name: owasp-top10',
        'description: "Check every endpoint: OWASP Top 10."',
        "type: 'security'",
        'license: MIT',
        'allowed-tools: Read, Grep',
        'metadata:',
        '  version: 2',
        '---',
        '',
        '# Rules',
        '- A01',
      ].join('\n'),
    );
    expect(parsed).toEqual({
      name: 'owasp-top10',
      description: 'Check every endpoint: OWASP Top 10.',
      type: 'security',
      body: '# Rules\n- A01',
      ignoredKeys: ['license', 'allowed-tools', 'metadata'],
    });
  });

  it('folds ">" and keeps "|" block descriptions', () => {
    const folded = parseSkillFile('---\ndescription: >\n  Flag secrets\n  in the diff.\n---\nbody');
    expect(folded.description).toBe('Flag secrets in the diff.');
    const literal = parseSkillFile('---\ndescription: |\n  line one\n  line two\n---\nbody');
    expect(literal.description).toBe('line one\nline two');
  });

  it('treats a file without frontmatter as body only', () => {
    expect(parseSkillFile('# Heading\n\ntext\n')).toEqual({ body: '# Heading\n\ntext', ignoredKeys: [] });
  });
});

describe('slugify', () => {
  it('makes a SKILL.md-style name', () => {
    expect(slugify('Secret Leakage Gate!')).toBe('secret-leakage-gate');
    expect(slugify('  Ünïcode — rules  ')).toBe('unicode-rules');
    expect(slugify('x'.repeat(80))).toHaveLength(64);
    expect(slugify('***')).toBe('');
  });
});

describe('buildPreview', () => {
  const base = { filename: 'owasp.zip', kind: 'archive' as const, ignored: [] };

  it('name: frontmatter, else the folder of SKILL.md, else the file name, else the first heading', () => {
    expect(buildPreview({ ...base, skillPath: 'x/SKILL.md', text: '---\nname: From FM\n---\nb' }).draft.name).toBe('from-fm');
    expect(buildPreview({ ...base, skillPath: 'Secret Gate/SKILL.md', text: 'b' }).draft.name).toBe('secret-gate');
    expect(buildPreview({ ...base, skillPath: 'SKILL.md', text: 'b' }).draft.name).toBe('owasp');
    expect(
      buildPreview({ filename: 'SKILL.md', kind: 'markdown', skillPath: 'SKILL.md', ignored: [], text: '# PR Quality\nb' })
        .draft.name,
    ).toBe('pr-quality');
  });

  it('defaults the type to custom and warns about what needs attention', () => {
    const p = buildPreview({
      ...base,
      skillPath: 'my-skill/SKILL.md',
      text: '---\ntype: weird\nlicense: MIT\n---\nRun `scripts/check.py` and read references/api.md.',
      ignored: [
        { path: 'my-skill/scripts/check.py', reason: 'script' },
        { path: 'my-skill/references/api.md', reason: 'other' },
        { path: 'my-skill/logo.png', reason: 'other' },
      ],
    });
    expect(p.draft.type).toBe('custom');
    expect(p.origin).toEqual({ filename: 'owasp.zip', kind: 'archive', skill_path: 'my-skill/SKILL.md' });
    expect(p.warnings).toEqual([
      'No description found — write a directive one before saving.',
      'Frontmatter keys ignored: license.',
      'The body refers to files that are not imported: scripts/check.py, references/api.md.',
    ]);
  });

  it('refuses a body over the limit', () => {
    expect(reasonOf(() => buildPreview({ ...base, skillPath: 'SKILL.md', text: 'x'.repeat(40_001) }))).toBe('too_large');
  });
});
