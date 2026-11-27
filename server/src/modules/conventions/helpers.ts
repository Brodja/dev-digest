import type { ConventionCandidate, ConventionScan, ConventionStatus } from '@devdigest/shared';
import type { ConventionRow, ConventionScanRow } from '../../db/rows.js';
import { locateSnippet } from './evidence.js';
import {
  CONFIG_FILE_NAMES,
  DUP_JACCARD,
  DUP_SAME_PLACE_JACCARD,
  MAX_CANDIDATES,
  MAX_LINE_CHARS,
  MAX_PROBE_DIRS,
  PROMPT_MAX_CHARS,
  PROMPT_MAX_LINES,
  RULE_MAX,
  RULE_MIN_CHARS,
  RULE_MIN_WORDS,
} from './constants.js';

/** Pure helpers of the conventions extractor (server/specs/003-conventions.md). */

// ---------------------------------------------------------------- sample set

/** Root + distinct first-level directories of the samples (a monorepo keeps configs per package). */
export function configProbeDirs(samples: readonly string[]): string[] {
  const dirs = [''];
  for (const path of samples) {
    const slash = path.indexOf('/');
    if (slash <= 0) continue;
    const dir = path.slice(0, slash);
    if (!dirs.includes(dir)) dirs.push(dir);
    if (dirs.length > MAX_PROBE_DIRS) break;
  }
  return dirs;
}

/**
 * Config paths to probe: first the tsconfig.json of the root and of every
 * sampled package (so each package's TS settings fit under MAX_CONFIG_FILES),
 * then the other config names per directory, root first.
 */
export function configCandidates(samples: readonly string[]): string[] {
  const dirs = configProbeDirs(samples);
  const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);
  const others = CONFIG_FILE_NAMES.filter((name) => name !== 'tsconfig.json');
  return [
    ...dirs.map((dir) => join(dir, 'tsconfig.json')),
    ...dirs.flatMap((dir) => others.map((name) => join(dir, name))),
  ];
}

/** Package of a repo path = its first segment ('' for a file at the root). */
export function packageOf(path: string): string {
  const slash = path.indexOf('/');
  return slash > 0 ? path.slice(0, slash) : '';
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash > 0 ? path.slice(0, slash) : '';
}

/** Tooling under a dot-directory (.claude, .github, …) is not the product's code. */
function isDotPath(path: string): boolean {
  return path.split('/').some((segment) => segment.startsWith('.'));
}

/** Group by key, keeping the first-appearance order of keys and of items. */
function groupInOrder<T>(items: readonly T[], key: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return [...groups.values()];
}

/** One item from each group in turn until all are used. */
function roundRobin<T>(groups: readonly (readonly T[])[]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < longest; i++) {
    for (const group of groups) {
      const item = group[i];
      if (item !== undefined) out.push(item);
    }
  }
  return out;
}

/**
 * Pick `n` samples spread evenly over packages (client, server, reviewer-core,
 * …), and inside a package over directories, keeping rank order within each
 * group. repo-intel ranks can be all equal (file_rank with one distinct rank),
 * and then "the top n" is just the DB's tie order — often one package or even
 * one folder. Dot-directories are skipped.
 */
export function spreadSamples(ranked: readonly string[], n: number): string[] {
  const candidates = [...new Set(ranked)].filter((p) => !isDotPath(p));
  const perPackage = groupInOrder(candidates, packageOf).map((files) => roundRobin(groupInOrder(files, dirOf)));
  return roundRobin(perPackage).slice(0, n);
}

/** Empty, binary (NUL) or minified (very long lines) text is not sent. */
export function isUsableSource(text: string): boolean {
  if (!text.trim() || text.includes('\0')) return false;
  return text.split('\n').every((line) => line.length <= MAX_LINE_CHARS);
}

export interface TruncatedText {
  text: string;
  totalLines: number;
  shownLines: number;
}

/** A prefix of whole lines (≤ PROMPT_MAX_LINES, ≤ PROMPT_MAX_CHARS): line numbers stay the file's. */
export function truncateForPrompt(text: string): TruncatedText {
  const all = text.split('\n');
  if (all.length > 1 && all[all.length - 1] === '') all.pop();
  const shown: string[] = [];
  let chars = 0;
  for (const line of all) {
    if (shown.length >= PROMPT_MAX_LINES) break;
    if (shown.length > 0 && chars + line.length + 1 > PROMPT_MAX_CHARS) break;
    shown.push(line);
    chars += line.length + 1;
  }
  return { text: shown.join('\n'), totalLines: all.length, shownLines: shown.length };
}

/** Model path → sample-set key: `\` → `/`, no leading `./` or `/`. Case is kept (GitHub URLs are case-sensitive). */
export function normalizeEvidencePath(path: string): string {
  let p = path.trim().replace(/\\/g, '/');
  while (p.startsWith('./')) p = p.slice(2);
  return p.replace(/^\/+/, '');
}

/** Used as the `source` attribute of <untrusted>: no quotes or angle brackets. */
export function sanitizeLabel(path: string): string {
  return path.replace(/["<>]/g, '');
}

// ---------------------------------------------------------------- grounding

export interface Proposal {
  rule: string;
  evidence_path: string;
  evidence_snippet: string;
  confidence: number;
}

export interface GroundedCandidate {
  rule: string;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  confidence: number;
}

/**
 * Models answer 0.85, 85 or 1.2: read 2 < x ≤ 100 as a percentage (85 → 0.85),
 * treat a small overshoot as 1, then clamp to 0..1.
 */
export function clampConfidence(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const v = x > 2 && x <= 100 ? x / 100 : x;
  return Math.min(1, Math.max(0, v));
}

function cleanRule(rule: string): string {
  return rule.replace(/\s+/g, ' ').trim().slice(0, RULE_MAX);
}

/** A checkable sentence, not a fragment like "Use `" (degenerate model output). */
export function isUsableRule(rule: string): boolean {
  const text = cleanRule(rule);
  return text.length >= RULE_MIN_CHARS && ruleTokens(text).size >= RULE_MIN_WORDS;
}

/**
 * Keep only proposals code can check: a usable rule text, a path that is one of
 * the files sent (`files`: path → the exact prepared text the model saw) and a
 * snippet that is in that file. Never reads anything a model path points to.
 * `droppedUngrounded` counts every proposal that failed; `invalidRules` the
 * subset whose rule text was unusable.
 */
export function groundProposals(
  proposals: readonly Proposal[],
  files: ReadonlyMap<string, string>,
): { grounded: GroundedCandidate[]; droppedUngrounded: number; invalidRules: number } {
  const grounded: GroundedCandidate[] = [];
  let droppedUngrounded = 0;
  let invalidRules = 0;
  for (const p of proposals) {
    if (!isUsableRule(p.rule)) {
      invalidRules++;
      droppedUngrounded++;
      continue;
    }
    const rule = cleanRule(p.rule);
    const path = normalizeEvidencePath(p.evidence_path);
    const text = files.get(path);
    const match = text !== undefined ? locateSnippet(text, p.evidence_snippet) : null;
    if (!match) {
      droppedUngrounded++;
      continue;
    }
    grounded.push({ rule, path, ...match, confidence: clampConfidence(p.confidence) });
  }
  return { grounded, droppedUngrounded, invalidRules };
}

// ---------------------------------------------------------------- dedupe

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'with', 'via', 'by', 'from', 'as',
  'is', 'are', 'be', 'all', 'any', 'each', 'every', 'always', 'never', 'must', 'should', 'use',
  'instead', 'not', 'no', 'do', 'that', 'this', 'it', 'its', 'their',
]);

/** Lower case, quotes/backticks dropped, punctuation → spaces, spaces collapsed. */
export function normalizeRule(rule: string): string {
  return rule
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function ruleTokens(rule: string): Set<string> {
  return new Set(normalizeRule(rule).split(' ').filter((w) => w && !STOP_WORDS.has(w)));
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** A rule with its evidence location (null for rows without one). */
export interface RuleRef {
  rule: string;
  path: string | null;
  startLine: number | null;
  endLine: number | null;
}

function samePlace(a: RuleRef, b: RuleRef): boolean {
  return (
    a.path !== null &&
    a.path === b.path &&
    a.startLine !== null &&
    a.endLine !== null &&
    b.startLine !== null &&
    b.endLine !== null &&
    a.startLine <= b.endLine &&
    b.startLine <= a.endLine
  );
}

/** Same normalised text, or token Jaccard ≥ 0.8, or same file + overlapping lines and Jaccard ≥ 0.5. */
export function isDuplicateRule(a: RuleRef, b: RuleRef): boolean {
  if (normalizeRule(a.rule) === normalizeRule(b.rule)) return true;
  const j = jaccard(ruleTokens(a.rule), ruleTokens(b.rule));
  return j >= DUP_JACCARD || (j >= DUP_SAME_PLACE_JACCARD && samePlace(a, b));
}

function refOf(c: GroundedCandidate): RuleRef {
  return { rule: c.rule, path: c.path, startLine: c.startLine, endLine: c.endLine };
}

/**
 * Highest confidence first; drop duplicates of decided rules (accepted or
 * rejected) and of a candidate already kept in this scan; cap at MAX_CANDIDATES.
 */
export function selectCandidates(
  grounded: readonly GroundedCandidate[],
  decided: readonly RuleRef[],
): { kept: GroundedCandidate[]; droppedDuplicate: number } {
  const kept: GroundedCandidate[] = [];
  let droppedDuplicate = 0;
  for (const c of [...grounded].sort((a, b) => b.confidence - a.confidence)) {
    const ref = refOf(c);
    const dup =
      decided.some((d) => isDuplicateRule(ref, d)) || kept.some((k) => isDuplicateRule(ref, refOf(k)));
    if (dup) droppedDuplicate++;
    else kept.push(c);
  }
  return { kept: kept.slice(0, MAX_CANDIDATES), droppedDuplicate };
}

// ---------------------------------------------------------------- status + DTOs

export function statusOf(row: { accepted: boolean; rejected: boolean }): ConventionStatus {
  if (row.accepted) return 'accepted';
  return row.rejected ? 'rejected' : 'pending';
}

export function flagsFor(status: ConventionStatus): { accepted: boolean; rejected: boolean } {
  return { accepted: status === 'accepted', rejected: status === 'rejected' };
}

/** DB row → API DTO. The list query returns only rows with evidence, so the fallbacks never fire. */
export function toConventionDto(row: ConventionRow): ConventionCandidate {
  const status = statusOf(row);
  const start = row.evidenceStartLine ?? 1;
  return {
    id: row.id,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: clampConfidence(row.confidence ?? 0),
    accepted: status === 'accepted',
    status,
    evidence_start_line: start,
    evidence_end_line: row.evidenceEndLine ?? start,
    commit_sha: row.commitSha,
    created_at: row.createdAt.toISOString(),
  };
}

export function toScanDto(row: ConventionScanRow): ConventionScan {
  return {
    id: row.id,
    status: row.status,
    error_code: row.errorCode,
    error_message: row.errorMessage,
    provider: row.provider,
    model: row.model,
    commit_sha: row.commitSha,
    files: row.files,
    proposed: row.proposed,
    kept: row.kept,
    dropped_ungrounded: row.droppedUngrounded,
    dropped_duplicate: row.droppedDuplicate,
    tokens_in: row.tokensIn,
    tokens_out: row.tokensOut,
    attempts: row.attempts,
    cost_usd: row.costUsd,
    started_at: row.startedAt.toISOString(),
    finished_at: row.finishedAt.toISOString(),
  };
}
