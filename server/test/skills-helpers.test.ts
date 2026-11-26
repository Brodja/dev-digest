import { describe, it, expect } from 'vitest';
import { SkillSource } from '@devdigest/shared';
import { isTrustedSkillSource } from '../src/platform/skill-trust.js';
import { skillNameTakenError, toSkillDetailDto, toSkillDto } from '../src/modules/skills/helpers.js';
import { SKILL_NAME_PATTERN } from '../src/modules/skills/constants.js';
import type { SkillRow } from '../src/db/rows.js';

/** Pure skills logic (server/specs/002-skills.md) — no DB. */

const row = (over: Partial<SkillRow> = {}): SkillRow => ({
  id: 'sk-1',
  workspaceId: 'ws-1',
  name: 'secret-leakage-gate',
  description: 'Flag any hard-coded secret added in the diff.',
  type: 'security',
  source: 'manual',
  body: '- sk_live_ keys are CRITICAL',
  enabled: true,
  version: 3,
  evidenceFiles: null,
  createdAt: new Date('2026-11-26T00:00:00Z'),
  ...over,
});

describe('isTrustedSkillSource', () => {
  it('trusts only what the user wrote or the product extracted', () => {
    const trusted = SkillSource.options.filter(isTrustedSkillSource);
    expect(trusted).toEqual(['manual', 'extracted']);
  });

  it('treats every imported source as untrusted', () => {
    for (const s of ['imported_file', 'imported_url', 'community'] as const) {
      expect(isTrustedSkillSource(s)).toBe(false);
    }
  });
});

describe('toSkillDto', () => {
  it('maps the row to the snake_case DTO and derives `trusted` from the source', () => {
    expect(toSkillDto(row())).toEqual({
      id: 'sk-1',
      name: 'secret-leakage-gate',
      description: 'Flag any hard-coded secret added in the diff.',
      type: 'security',
      source: 'manual',
      body: '- sk_live_ keys are CRITICAL',
      enabled: true,
      version: 3,
      evidence_files: null,
      trusted: true,
    });
    expect(toSkillDto(row({ source: 'imported_file' })).trusted).toBe(false);
  });

  it('adds used_by on the detail DTO', () => {
    const detail = toSkillDetailDto(row(), [{ id: 'a1', name: 'General Reviewer' }]);
    expect(detail.used_by).toEqual([{ id: 'a1', name: 'General Reviewer' }]);
    expect(detail.trusted).toBe(true);
  });
});

describe('skill names', () => {
  it('accepts kebab-case slugs up to 64 chars', () => {
    for (const ok of ['a', 'secret-leakage-gate', 'owasp-top10', '9lives', 'a'.repeat(64)]) {
      expect(SKILL_NAME_PATTERN.test(ok)).toBe(true);
    }
  });

  it('rejects anything that could break the prompt attribute or the slug rule', () => {
    for (const bad of ['', '-lead', 'Upper', 'has space', 'quote"x', 'a/b', 'a'.repeat(65)]) {
      expect(SKILL_NAME_PATTERN.test(bad)).toBe(false);
    }
  });

  it('a taken name is a 409 skill_name_taken', () => {
    const err = skillNameTakenError('secret-leakage-gate');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('skill_name_taken');
  });
});
