// Shared helpers for the pr-self-review scripts. Node builtins only (Node 20+).
// Everything here is read-only: it asks git what changed and classifies it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Run git and return stdout with CR stripped (core.autocrlf=true on Windows). */
export function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 << 20, ...opts }).replace(/\r/g, '');
}

export const repoRoot = () => git(['rev-parse', '--show-toplevel']).trim();

/** Merge-base of HEAD with the given ref, else origin/main, else main. */
export function resolveBase(arg) {
  const candidates = arg ? [arg] : ['origin/main', 'main'];
  for (const ref of candidates) {
    try {
      return { ref, sha: git(['merge-base', ref, 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] }).trim() };
    } catch { /* try the next candidate */ }
  }
  throw new Error(`pr-self-review: no merge-base between HEAD and ${candidates.join(' / ')}`);
}

// Template skills from the course starter: root AGENTS.md says never edit them.
const TEMPLATE_SKILLS = [
  'drizzle-orm-patterns', 'fastify-best-practices', 'mermaid-diagram', 'next-best-practices',
  'postgresql-table-design', 'react-best-practices', 'react-testing-library', 'security',
  'typescript-expert', 'zod',
];

/** Surface = which skill set reviews the file. Docs anywhere get the general check only. */
export function surfaceOf(p) {
  if (/\.mdx?$/i.test(p)) return 'rest';
  if (p.startsWith('client/')) return 'client';
  if (p.startsWith('server/') || p.startsWith('reviewer-core/')) return 'backend';
  if (p.startsWith('e2e/')) return 'e2e';
  return 'rest';
}

/** Package whose typecheck/tests a changed code file triggers. */
export function packageOf(p) {
  const top = p.split('/')[0];
  return ['client', 'server', 'reviewer-core', 'e2e'].includes(top) && !/\.mdx?$/i.test(p) ? top : null;
}

/** Tags drive extra skills and the deterministic flags (see routing.md). */
export function tagsOf(p, status) {
  const t = [];
  const base = path.posix.basename(p);
  if (/^server\/src\/db\/migrations\//.test(p)) t.push(status === 'A' || status === '?' ? 'migration-new' : 'migration-edit');
  if (/^(client|server)\/package-lock\.json$/.test(p) || /^(reviewer-core|e2e)\/pnpm-lock\.yaml$/.test(p)) t.push('wrong-lockfile');
  else if (/(^|\/)(pnpm-lock\.yaml|package-lock\.json)$/.test(p)) t.push('lockfile');
  if ((/^\.env(\..+)?$/.test(base) && !/\.example$/.test(base)) || base === 'secrets.json') t.push('secret-file');
  if (/(^|\/)(\.next|dist|node_modules)\//.test(p)) t.push('generated');
  if (/\/src\/vendor\/shared\//.test(p)) t.push('contract');
  if (/^server\/src\/modules\/[^/]+\/routes\.ts$/.test(p)) t.push('route');
  if (/^server\/src\/db\/schema(\.ts$|\/)/.test(p)) t.push('db-schema');
  if (/^client\/src\/app\//.test(p)) t.push('app-router');
  if (/\.it\.test\.tsx?$/.test(p)) t.push('it-test');
  else if (/\.test\.tsx?$/.test(p)) t.push('test');
  if (/^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(p)) t.push('skill');
  const skillDir = p.match(/^\.claude\/skills\/([^/]+)\//)?.[1];
  if (skillDir && TEMPLATE_SKILLS.includes(skillDir)) t.push('template-skill');
  return t;
}

/** Skills to load for one file, per routing.md. */
export function skillsOf(p, surface, tags) {
  const s = [];
  if (surface === 'client') {
    s.push('frontend-architecture', 'react-best-practices', 'react-testing-library');
    if (tags.includes('app-router')) s.push('next-best-practices');
  }
  if (surface === 'backend') s.push('onion-architecture', 'fastify-best-practices', 'drizzle-orm-patterns');
  if (/\.tsx?$/.test(p)) s.push('security');
  if (tags.includes('contract') || tags.includes('route')) s.push('zod');
  if (tags.includes('db-schema')) s.push('postgresql-table-design');
  if (s.length === 0) s.push('general');
  return s;
}

/** Parse `git diff -U0` into { path: [[start, end], ...] } of added/modified new-side lines. */
function addedRanges(diffText) {
  const out = {};
  let cur = null;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ ')) {
      cur = line === '+++ /dev/null' ? null : line.slice(6); // strip "+++ b/"
      if (cur) out[cur] ??= [];
      continue;
    }
    const m = cur && line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      const start = Number(m[1]);
      const len = m[2] === undefined ? 1 : Number(m[2]);
      if (len > 0) out[cur].push([start, start + len - 1]);
    }
  }
  return out;
}

/**
 * All open changes vs base: committed-not-merged + staged + unstaged (git diff <base>)
 * plus untracked files. Returns one record per file.
 */
export function collectChanges(baseSha) {
  const root = repoRoot();
  const files = new Map();
  const add = (p, status, from) => {
    const surface = surfaceOf(p);
    const tags = tagsOf(p, status);
    files.set(p, { path: p, status, from, surface, pkg: packageOf(p), tags, skills: skillsOf(p, surface, tags), added: [] });
  };

  // -M -C: a file moved and replaced by a stub at the old path (CLAUDE.md -> AGENTS.md)
  // shows as a copy, so only its really changed lines count as added.
  const ns = git(['-c', 'core.quotePath=false', 'diff', '--name-status', '-M', '-C', '-z', baseSha], { cwd: root }).split('\0');
  for (let i = 0; i < ns.length; ) {
    const st = ns[i++];
    if (!st) continue;
    const code = st[0];
    if (code === 'R' || code === 'C') { const from = ns[i++]; add(ns[i++], code, from); }
    else add(ns[i++], code);
  }
  for (const p of git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).split('\0').filter(Boolean)) add(p, '?');

  const ranges = addedRanges(git(
    ['-c', 'core.quotePath=false', 'diff', '-U0', '-M', '-C', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', baseSha],
    { cwd: root },
  ));
  for (const f of files.values()) {
    if (f.status === '?') {
      let n = 0;
      try { n = readFileSync(path.join(root, f.path), 'utf8').split(/\r?\n/).length; } catch { /* unreadable: no lines */ }
      f.added = n ? [[1, n]] : [];
    } else {
      f.added = ranges[f.path] ?? [];
    }
  }
  return { root, files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)) };
}

export const lineIsAdded = (file, line) => !!file && file.added.some(([s, e]) => line >= s && line <= e);
export const fmtRanges = (r) => r.map(([s, e]) => (s === e ? `${s}` : `${s}-${e}`)).join(',') || '—';
