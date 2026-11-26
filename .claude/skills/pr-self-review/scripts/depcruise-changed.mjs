#!/usr/bin/env node
// pr-self-review: run the onion-architecture dependency-cruiser gate and keep only the
// violations that involve files changed on this branch (no fixed baseline to go stale).
// Usage (repo root): node .claude/skills/pr-self-review/scripts/depcruise-changed.mjs [base-ref]
//
// Classes:  CRITICAL  error-rule violation whose import line is new on this branch
//           WARNING   warn-rule violation whose import line is new on this branch
//           OLD       violation in a file this branch touches, but the import is not new
// Violations in files the branch does not touch are only counted.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveBase, collectChanges, lineIsAdded } from './lib.mjs';

const base = resolveBase(process.argv[2]);
const { root, files } = collectChanges(base.sha);
const changed = new Map(files.filter((f) => f.status !== 'D').map((f) => [f.path, f]));

if (![...changed.values()].some((f) => f.surface === 'backend')) {
  console.log('depcruise: skipped (no server/ or reviewer-core/ code changed)');
  process.exit(0);
}

const config = '../.claude/skills/onion-architecture/depcruise.config.cjs';
let raw;
try {
  raw = execSync(`pnpm exec depcruise src ../reviewer-core/src --config ${config} --output-type json`, {
    cwd: path.join(root, 'server'), encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  raw = e.stdout; // depcruise exits non-zero when error-rules fire; the JSON is still on stdout
  if (!raw) { console.error(`depcruise failed to run:\n${e.stderr || e.message}`); process.exit(2); }
}
const result = JSON.parse(raw.slice(raw.indexOf('{')));

// depcruise paths are relative to server/: src/... or ../reviewer-core/src/...
const isLocal = (p) => p.startsWith('src/') || p.startsWith('../');
const toRepo = (p) => (isLocal(p) ? path.posix.normalize(`server/${p}`) : p);
const modules = new Map(result.modules.map((m) => [m.source, m]));

/** Line numbers in `from` that import `target` (by the specifier depcruise recorded). */
function importLines(from, target) {
  const dep = modules.get(from)?.dependencies.find((d) => d.resolved === target);
  if (!dep) return [];
  let text;
  try { text = readFileSync(path.join(root, toRepo(from)), 'utf8'); } catch { return []; }
  const quoted = [`'${dep.module}'`, `"${dep.module}"`];
  return text.split(/\r?\n/).flatMap((l, i) => (quoted.some((q) => l.includes(q)) ? [i + 1] : []));
}

const out = { CRITICAL: [], WARNING: [], OLD: [] };
let untouched = 0;
for (const v of result.summary.violations) {
  const cycle = (v.cycle ?? []).map((c) => (typeof c === 'string' ? c : c.name));
  const target = cycle[0] ?? v.to;
  const fromFile = changed.get(toRepo(v.from));
  const touched = !!fromFile || [target, ...cycle].some((p) => changed.has(toRepo(p)));
  if (!touched) { untouched++; continue; }

  const lines = importLines(v.from, target);
  const isNew = !!fromFile && (fromFile.status === 'A' || fromFile.status === '?' || lines.some((n) => lineIsAdded(fromFile, n)));
  const where = `${toRepo(v.from)}${lines.length ? `:${lines.join(',')}` : ''}`;
  const via = cycle.length ? `cycle ${[v.from, ...cycle].map(toRepo).join(' -> ')}` : toRepo(v.to);
  const cls = !isNew ? 'OLD' : v.rule.severity === 'error' ? 'CRITICAL' : 'WARNING';
  out[cls].push(`${cls.padEnd(8)} ${v.rule.name}  ${where} -> ${via}`);
}

const s = result.summary;
console.log(`depcruise (onion-architecture gate): ${s.totalCruised} modules, ${s.totalDependenciesCruised} deps · overall ${s.error} errors / ${s.warn} warnings`);
for (const cls of ['CRITICAL', 'WARNING', 'OLD']) for (const l of out[cls]) console.log(l);
if (!out.CRITICAL.length && !out.WARNING.length && !out.OLD.length) console.log('no violations involve changed files');
console.log(`ignored: ${untouched} violation(s) in files this branch does not touch`);
