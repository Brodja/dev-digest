#!/usr/bin/env node
// Step 1 of pr-self-review: what changed on this branch vs main, and how to review it.
// Usage (repo root): node .claude/skills/pr-self-review/scripts/scope.mjs [base-ref]
// Read-only. Prints the base, every changed file (surface, status, added lines, tags,
// skills), the deterministic checks to run, and the hard CRITICAL flags.
import { git, resolveBase, collectChanges, fmtRanges } from './lib.mjs';

const base = resolveBase(process.argv[2]);
const { files } = collectChanges(base.sha);
const head = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const headSha = git(['rev-parse', '--short', 'HEAD']).trim();
const dirty = git(['status', '--porcelain']).trim() !== '';

console.log('pr-self-review scope');
console.log(`base   ${base.ref} @ ${base.sha.slice(0, 7)} (merge-base with HEAD)`);
console.log(`head   ${head} @ ${headSha}${dirty ? ' + uncommitted/untracked changes' : ''}`);

if (files.length === 0) {
  console.log('\nNo changes vs base. Verdict: READY (nothing to review).');
  process.exit(0);
}

console.log('\nsurface  st  added        file  [tags] -> skills');
for (const f of files) {
  const st = f.status === '?' ? '??' : f.status.padEnd(2);
  const from = f.from ? ` (from ${f.from})` : '';
  const tags = f.tags.length ? `  [${f.tags.join(', ')}]` : '';
  console.log(`${f.surface.padEnd(8)} ${st}  ${fmtRanges(f.added).padEnd(12)} ${f.path}${from}${tags} -> ${f.skills.join(', ')}`);
}

const live = files.filter((f) => f.status !== 'D');
const pkgs = new Set(live.map((f) => f.pkg).filter(Boolean));
if (pkgs.has('reviewer-core')) pkgs.add('server'); // server typecheck compiles reviewer-core/src
const COMMANDS = {
  client: ['cd client && pnpm typecheck', 'cd client && pnpm test'],
  server: ['cd server && pnpm typecheck', "cd server && pnpm exec vitest run --exclude '**/*.it.test.ts'"],
  'reviewer-core': ['cd reviewer-core && npm run typecheck', 'cd reviewer-core && npm test'],
  e2e: ['cd e2e && npm run typecheck'],
};
const order = ['reviewer-core', 'server', 'client', 'e2e'].filter((p) => pkgs.has(p));
console.log('\ndeterministic checks (run in this order, from the repo root):');
if (order.length === 0) console.log('  none: no package code changed');
for (const p of order) for (const c of COMMANDS[p]) console.log(`  ${c}`);
if (live.some((f) => f.surface === 'backend')) {
  console.log(`  node .claude/skills/pr-self-review/scripts/depcruise-changed.mjs${process.argv[2] ? ' ' + process.argv[2] : ''}`);
}

const FLAGS = {
  'migration-edit': 'applied migration edited or deleted (server/AGENTS.md: generate a new one)',
  'wrong-lockfile': 'lockfile of the wrong package manager (root AGENTS.md: pnpm in client/server, npm in reviewer-core/e2e)',
  'secret-file': 'secret file in the diff (.env / secrets.json)',
};
const flags = files.flatMap((f) => f.tags.filter((t) => FLAGS[t]).map((t) => `  CRITICAL ${t}: ${f.path} — ${FLAGS[t]}`));
const notes = files.flatMap((f) => [
  ...(f.tags.includes('template-skill') ? [`  WARNING template-skill: ${f.path} — template skills are do-not-touch (root AGENTS.md)`] : []),
  ...(f.tags.includes('generated') ? [`  WARNING generated: ${f.path} — build output in the diff`] : []),
]);
console.log('\nhard flags:');
console.log(flags.length || notes.length ? [...flags, ...notes].join('\n') : '  none');

const by = (s) => files.filter((f) => f.surface === s).length;
const untracked = files.filter((f) => f.status === '?').length;
console.log(`\nsummary  files ${files.length} · client ${by('client')} · backend ${by('backend')} · e2e ${by('e2e')} · rest ${by('rest')} · untracked ${untracked}`);
