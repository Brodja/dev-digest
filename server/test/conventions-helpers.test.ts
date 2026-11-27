import { describe, it, expect } from 'vitest';
import {
  clampConfidence,
  configCandidates,
  configProbeDirs,
  flagsFor,
  groundProposals,
  isDuplicateRule,
  isUsableRule,
  isUsableSource,
  normalizeEvidencePath,
  normalizeRule,
  packageOf,
  selectCandidates,
  spreadSamples,
  statusOf,
  toConventionDto,
  truncateForPrompt,
  type GroundedCandidate,
} from '../src/modules/conventions/helpers.js';
import { locateSnippet } from '../src/modules/conventions/evidence.js';
import type { ConventionRow } from '../src/db/rows.js';

const SERVICE = [
  "import { NotFoundError } from '../../platform/errors.js';",
  '',
  'export class UsersService {',
  '  async get(id: string) {',
  '    const user = await this.repo.findById(id);',
  "    if (!user) throw new NotFoundError('User not found');",
  '    return user;',
  '  }',
  '}',
].join('\n');

describe('sample set', () => {
  it('probes the root, then distinct first-level dirs (a monorepo keeps configs per package)', () => {
    const samples = ['server/src/a.ts', 'client/src/b.tsx', 'server/x.ts', 'top.ts', 'reviewer-core/src/c.ts', 'e2e/d.ts', 'more/e.ts'];
    expect(configProbeDirs(samples)).toEqual(['', 'server', 'client', 'reviewer-core', 'e2e']);
    const candidates = configCandidates(['server/src/a.ts', 'client/src/b.tsx']);
    // Every package's tsconfig comes first, so all of them fit under MAX_CONFIG_FILES.
    expect(candidates.slice(0, 3)).toEqual(['tsconfig.json', 'server/tsconfig.json', 'client/tsconfig.json']);
    expect(candidates).toContain('server/eslint.config.mjs');
    expect(candidates.indexOf('.prettierrc')).toBeLessThan(candidates.indexOf('server/.prettierrc'));
  });

  it('spreads samples over packages, then over directories, skipping dot-dirs (tied ranks)', () => {
    // One package first, as the DB returns tied ranks: a plain "top 12" would be all client.
    const ranked = [
      '.claude/skills/a/scope.mjs',
      'client/src/app/a.tsx',
      'client/src/app/b.tsx',
      'client/src/lib/c.ts',
      'client/src/lib/d.ts',
      'client/src/components/e.tsx',
      'client/src/app/f.tsx',
      'client/src/app/g.tsx',
      'server/src/platform/a.ts',
      'server/src/platform/b.ts',
      'server/src/modules/x/c.ts',
      'server/src/db/d.ts',
      'reviewer-core/src/a.ts',
      'reviewer-core/src/b.ts',
    ];
    expect(spreadSamples(ranked, 12)).toEqual([
      'client/src/app/a.tsx',
      'server/src/platform/a.ts',
      'reviewer-core/src/a.ts',
      'client/src/lib/c.ts',
      'server/src/modules/x/c.ts',
      'reviewer-core/src/b.ts',
      'client/src/components/e.tsx',
      'server/src/db/d.ts',
      'client/src/app/b.tsx',
      'server/src/platform/b.ts',
      'client/src/lib/d.ts',
      'client/src/app/f.tsx',
    ]);
  });

  it('keeps rank order inside one directory, dedupes, and returns fewer when there are fewer', () => {
    expect(spreadSamples(['src/a.ts', 'src/b.ts', 'src/a.ts', 'top.ts'], 12)).toEqual(['src/a.ts', 'top.ts', 'src/b.ts']);
    expect(packageOf('top.ts')).toBe('');
    expect(packageOf('server/src/a.ts')).toBe('server');
  });

  it('skips empty, binary and minified text', () => {
    expect(isUsableSource('')).toBe(false);
    expect(isUsableSource('  \n ')).toBe(false);
    expect(isUsableSource('a\0b')).toBe(false);
    expect(isUsableSource(`x = "${'a'.repeat(1200)}";`)).toBe(false);
    expect(isUsableSource(SERVICE)).toBe(true);
  });

  it('truncates to a prefix of whole lines, so line numbers stay the file’s', () => {
    const lines = Array.from({ length: 300 }, (_, i) => `export const v${i + 1} = ${i + 1};`);
    const cut = truncateForPrompt(lines.join('\n') + '\n');
    expect(cut).toMatchObject({ totalLines: 300, shownLines: 250 });
    expect(cut.text.split('\n')[9]).toBe(lines[9]);
    // A snippet past the cut is not evidence: the model never saw it.
    expect(locateSnippet(cut.text, lines[259]!)).toBeNull();
    expect(locateSnippet(cut.text, lines[100]!)?.startLine).toBe(101);
  });

  it('also stops at the character budget', () => {
    const long = Array.from({ length: 100 }, () => 'x'.repeat(199)).join('\n');
    const cut = truncateForPrompt(long);
    expect(cut.shownLines).toBe(60);
    expect(cut.text.length).toBeLessThanOrEqual(12_000);
  });
});

describe('grounding', () => {
  it('normalises the model’s path but keeps its case', () => {
    expect(normalizeEvidencePath('./src/a.ts')).toBe('src/a.ts');
    expect(normalizeEvidencePath('src\\mod\\a.ts')).toBe('src/mod/a.ts');
    expect(normalizeEvidencePath('/src/a.ts')).toBe('src/a.ts');
    expect(normalizeEvidencePath('Src/A.ts')).toBe('Src/A.ts');
  });

  it('keeps only proposals whose file was sent and whose snippet is in it', () => {
    const files = new Map([['src/users/service.ts', SERVICE]]);
    const snippet = "const user = await this.repo.findById(id);\n    if (!user) throw new NotFoundError('User not found');";
    const { grounded, droppedUngrounded } = groundProposals(
      [
        { rule: '  Throw NotFoundError   from services. ', evidence_path: './src/users/service.ts', evidence_snippet: snippet, confidence: 90 },
        { rule: 'Wrong case', evidence_path: 'src/Users/service.ts', evidence_snippet: snippet, confidence: 0.9 },
        { rule: 'Traversal', evidence_path: '../../etc/passwd', evidence_snippet: 'root:x:0:0:root:/root:/bin/bash', confidence: 0.9 },
        { rule: 'Not in file', evidence_path: 'src/users/service.ts', evidence_snippet: 'return this.cache.get(id) ?? null;', confidence: 0.9 },
        { rule: '   ', evidence_path: 'src/users/service.ts', evidence_snippet: snippet, confidence: 0.9 },
      ],
      files,
    );
    expect(droppedUngrounded).toBe(4);
    expect(grounded).toEqual([
      {
        rule: 'Throw NotFoundError from services.',
        path: 'src/users/service.ts',
        startLine: 5,
        endLine: 6,
        snippet: "    const user = await this.repo.findById(id);\n    if (!user) throw new NotFoundError('User not found');",
        confidence: 0.9,
      },
    ]);
  });

  it('drops fragment rules even when their evidence is real (degenerate model output)', () => {
    const files = new Map([['src/users/service.ts', SERVICE]]);
    const snippet = "if (!user) throw new NotFoundError('User not found');";
    const { grounded, droppedUngrounded, invalidRules } = groundProposals(
      [
        { rule: 'Use `', evidence_path: 'src/users/service.ts', evidence_snippet: snippet, confidence: 1 },
        { rule: 'Use the', evidence_path: 'src/users/service.ts', evidence_snippet: snippet, confidence: 1 },
        { rule: 'Throw NotFoundError for missing users.', evidence_path: 'src/users/service.ts', evidence_snippet: snippet, confidence: 1 },
      ],
      files,
    );
    expect(grounded.map((g) => g.rule)).toEqual(['Throw NotFoundError for missing users.']);
    expect([droppedUngrounded, invalidRules]).toEqual([2, 2]);
    expect(isUsableRule('Use node: protocol for built-in imports.')).toBe(true);
  });

  it('reads confidence 85 as 85 %, clamps overshoot and junk', () => {
    expect(clampConfidence(0.85)).toBe(0.85);
    expect(clampConfidence(85)).toBe(0.85);
    expect(clampConfidence(1.2)).toBe(1);
    expect(clampConfidence(-3)).toBe(0);
    expect(clampConfidence(500)).toBe(1);
    expect(clampConfidence(Number.NaN)).toBe(0);
  });
});

describe('dedupe', () => {
  const at = (rule: string, path: string | null = null, startLine: number | null = null, endLine: number | null = null) => ({
    rule,
    path,
    startLine,
    endLine,
  });

  it('treats the same text (case, punctuation, backticks) as a duplicate', () => {
    expect(normalizeRule('Use `AppError`, never Error!')).toBe('use apperror never error');
    expect(isDuplicateRule(at('Use `AppError`, never Error!'), at('use apperror never error'))).toBe(true);
  });

  it('treats a rephrasing with token Jaccard ≥ 0.8 as a duplicate', () => {
    expect(
      isDuplicateRule(
        at('Throw NotFoundError from services when an entity is missing.'),
        at('Services throw NotFoundError when an entity is missing'),
      ),
    ).toBe(true);
  });

  it('needs only Jaccard ≥ 0.5 when both cite overlapping lines of the same file', () => {
    const a = 'Throw NotFoundError from services when an entity is missing; never return null.';
    const b = 'Services throw NotFoundError when an entity is missing.';
    expect(isDuplicateRule(at(a), at(b))).toBe(false);
    expect(isDuplicateRule(at(a, 'src/s.ts', 5, 6), at(b, 'src/s.ts', 6, 8))).toBe(true);
    expect(isDuplicateRule(at(a, 'src/s.ts', 5, 6), at(b, 'src/s.ts', 7, 8))).toBe(false);
  });

  it('keeps distinct rules apart', () => {
    expect(isDuplicateRule(at('Name files in kebab-case.'), at('Validate route bodies with Zod.'))).toBe(false);
  });

  it('selects by confidence, drops duplicates of decided rules and within the scan, caps at 15', () => {
    const c = (rule: string, confidence: number): GroundedCandidate => ({
      rule,
      path: `src/${rule.length}.ts`,
      startLine: 1,
      endLine: 1,
      snippet: 'x',
      confidence,
    });
    const { kept, droppedDuplicate } = selectCandidates(
      [
        c('Validate route bodies with Zod.', 0.6),
        c('validate route bodies with zod', 0.9),
        c('Name files in kebab-case.', 0.8),
      ],
      [at('Name files in kebab case')],
    );
    expect(kept.map((k) => k.rule)).toEqual(['validate route bodies with zod']);
    expect(droppedDuplicate).toBe(2);

    const many = Array.from({ length: 20 }, (_, i) => c(`Rule number ${i} about topic${i} and area${i}`, i / 20));
    expect(selectCandidates(many, []).kept).toHaveLength(15);
  });
});

describe('status and DTO', () => {
  it('maps status ↔ the two flags', () => {
    expect(statusOf({ accepted: false, rejected: false })).toBe('pending');
    expect(statusOf({ accepted: true, rejected: false })).toBe('accepted');
    expect(statusOf({ accepted: false, rejected: true })).toBe('rejected');
    expect(flagsFor('accepted')).toEqual({ accepted: true, rejected: false });
    expect(flagsFor('pending')).toEqual({ accepted: false, rejected: false });
  });

  it('derives status and accepted in the DTO', () => {
    const row: ConventionRow = {
      id: 'c1',
      workspaceId: 'w1',
      repoId: 'r1',
      rule: 'Rule',
      evidencePath: 'src/a.ts',
      evidenceSnippet: 'line',
      confidence: 0.7,
      accepted: false,
      rejected: true,
      evidenceStartLine: 3,
      evidenceEndLine: 4,
      commitSha: 'abc',
      createdAt: new Date('2026-11-26T10:00:00Z'),
    };
    expect(toConventionDto(row)).toEqual({
      id: 'c1',
      rule: 'Rule',
      evidence_path: 'src/a.ts',
      evidence_snippet: 'line',
      confidence: 0.7,
      accepted: false,
      status: 'rejected',
      evidence_start_line: 3,
      evidence_end_line: 4,
      commit_sha: 'abc',
      created_at: '2026-11-26T10:00:00.000Z',
    });
  });
});
