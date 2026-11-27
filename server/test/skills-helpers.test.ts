import { describe, it, expect } from 'vitest';
import { SkillSource } from '@devdigest/shared';
import { isTrustedSkillSource } from '../src/platform/skill-trust.js';
import {
  skillNameTakenError,
  toSkillDetailDto,
  toSkillDto,
  toSkillListItemDto,
  toSkillStatsDto,
  toSkillVersionDto,
  usageRates,
} from '../src/modules/skills/helpers.js';
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

describe('toSkillVersionDto', () => {
  it('maps a body snapshot with an ISO date', () => {
    expect(
      toSkillVersionDto({ skillId: 'sk-1', version: 2, body: 'b', createdAt: new Date('2026-11-27T10:00:00Z') }),
    ).toEqual({ skill_id: 'sk-1', version: 2, body: 'b', created_at: '2026-11-27T10:00:00.000Z' });
  });
});

describe('usageRates (list card / Stats)', () => {
  const counts = { usedBy: 2, runs: 3, totalRuns: 12, accepted: 6, dismissed: 2 };

  it('pull = runs that sent the skill / all traced runs; accept = accepted / decided findings', () => {
    expect(usageRates(counts)).toEqual({ used_by_count: 2, pull_rate: 0.25, accept_rate: 0.75 });
  });

  it('is null, not 0, when there is nothing to divide by', () => {
    expect(usageRates({ ...counts, runs: 0, totalRuns: 0 })).toMatchObject({ pull_rate: null });
    expect(usageRates({ ...counts, accepted: 0, dismissed: 0 })).toMatchObject({ accept_rate: null });
    expect(usageRates(undefined)).toEqual({ used_by_count: 0, pull_rate: null, accept_rate: null });
  });

  it('a skill no run sent in a workspace with runs has a real 0% pull and no accept rate', () => {
    expect(usageRates({ usedBy: 0, runs: 0, totalRuns: 5, accepted: 0, dismissed: 0 })).toEqual({
      used_by_count: 0,
      pull_rate: 0,
      accept_rate: null,
    });
  });

  it('puts the rates on the list DTO next to the skill fields', () => {
    expect(toSkillListItemDto(row(), counts)).toMatchObject({ id: 'sk-1', used_by_count: 2, pull_rate: 0.25, accept_rate: 0.75 });
  });
});

describe('toSkillStatsDto', () => {
  const usage = [
    { agentId: 'a1', agentName: 'Alpha', agentEnabled: true, linkEnabled: true, position: 2 },
    { agentId: 'a2', agentName: 'Beta', agentEnabled: false, linkEnabled: false, position: 1 },
  ];

  it('counts agents and the ones whose prompt gets the skill (link on AND skill on)', () => {
    const stats = toSkillStatsDto(row(), 3, usage);
    expect(stats).toMatchObject({ skill_id: 'sk-1', version: 3, version_count: 3, used_by_count: 2, in_prompt_count: 1 });
    expect(stats.agents).toEqual([
      { agent_id: 'a1', agent_name: 'Alpha', agent_enabled: true, link_enabled: true, position: 2, in_prompt: true },
      { agent_id: 'a2', agent_name: 'Beta', agent_enabled: false, link_enabled: false, position: 1, in_prompt: false },
    ]);
  });

  it('a globally disabled skill is in no prompt', () => {
    const stats = toSkillStatsDto(row({ enabled: false }), 1, usage);
    expect(stats.in_prompt_count).toBe(0);
    expect(stats.agents.every((a) => !a.in_prompt)).toBe(true);
  });

  it('an unused skill has no agents', () => {
    expect(toSkillStatsDto(row(), 1, [])).toMatchObject({ used_by_count: 0, in_prompt_count: 0, agents: [] });
  });

  it('carries the pull and accept rates (null without data)', () => {
    expect(toSkillStatsDto(row(), 1, [])).toMatchObject({ pull_rate: null, accept_rate: null });
    expect(
      toSkillStatsDto(row(), 1, [], { usedBy: 0, runs: 1, totalRuns: 4, accepted: 1, dismissed: 1 }),
    ).toMatchObject({ pull_rate: 0.25, accept_rate: 0.5 });
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
