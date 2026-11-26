/**
 * DevDigest onion gate for dependency-cruiser (server/ already depends on it).
 * Run from server/:
 *   pnpm exec depcruise src ../reviewer-core/src --config ../.claude/skills/onion-architecture/depcruise.config.cjs
 * Baseline and rationale: enforcement.md next to this file.
 *
 * Path patterns are matched against RESOLVED paths, which look like
 * `src/modules/...`, `../reviewer-core/src/...`, `node_modules/drizzle-orm/index.cjs`,
 * a bare `octokit` (unresolvable ESM exports map) or `fs` (core module; `node:fs`
 * imports resolve to `fs`). So packages are matched with `(^|node_modules/)name(/|$)`,
 * never `^name`, and node_modules must NOT be in `exclude` (that drops the edges).
 */

/** npm packages that mean I/O or a framework; `pkg()` builds a resolved-path pattern. */
const pkg = (names) => `(^|node_modules/)(${names.join('|')})(/|$)`;
const SDKS = [
  'fastify', '@fastify/[^/]+', 'fastify-[^/]+', 'drizzle-orm', 'postgres', 'octokit',
  'simple-git', '@vscode/ripgrep', '@ast-grep/napi', 'js-tiktoken', 'dependency-cruiser',
  '@anthropic-ai/sdk',
];
const LLM_SDK = ['openai'];
const NODE_IO = '^(node:)?(fs|child_process|net|http|https)(/|$)';
const SERVER_RINGS = '(^|/)src/(adapters|db|modules|platform)/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-is-pure',
      comment:
        'reviewer-core is the domain core: no DB, server code, filesystem, sockets or SDKs ' +
        '(reviewer-core/AGENTS.md). Its LLM call goes through the injected LLMProvider.',
      severity: 'error',
      from: { path: 'reviewer-core/src/', pathNot: 'reviewer-core/src/llm/' },
      to: { path: [pkg([...SDKS, ...LLM_SDK]), NODE_IO, SERVER_RINGS] },
    },
    {
      name: 'core-llm-only-openai',
      comment:
        'reviewer-core/src/llm/ holds OpenRouterProvider, the one LLMProvider adapter that lives ' +
        'in core (it uses the openai SDK). It may use `openai`, nothing else with I/O.',
      severity: 'error',
      from: { path: 'reviewer-core/src/llm/' },
      to: { path: [pkg(SDKS), NODE_IO, SERVER_RINGS] },
    },
    {
      name: 'ports-are-abstract',
      comment: '@devdigest/shared declares contracts and ports only: zod, nothing concrete.',
      severity: 'error',
      from: { path: '^src/vendor/shared/' },
      to: { path: [pkg([...SDKS, ...LLM_SDK]), NODE_IO, SERVER_RINGS] },
    },
    {
      name: 'services-depend-on-ports',
      comment:
        'A feature service reaches adapters through container.*, never by importing them. ' +
        'repo-intel is exempt: it IS the indexer infrastructure behind the container.repoIntel facade.',
      severity: 'error',
      from: {
        path: '^src/modules/[^/]+/(service|run-executor)[^/]*\\.ts$',
        pathNot: '^src/modules/repo-intel/',
      },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'routes-are-thin',
      comment: 'Transport (routes.ts) calls a service or container.*; it never imports an adapter.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'adapters-dont-know-modules',
      comment:
        'Infrastructure must not depend on a feature. Exception: adapters/astgrep and ' +
        'adapters/depgraph read repo-intel/constants (SUPPORTED_EXT, MAX_SIGNATURE_CHARS); ' +
        'moving those constants out of modules/ removes it.',
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: { path: '^src/modules/', pathNot: '^src/modules/repo-intel/constants\\.ts$' },
    },
    {
      name: 'module-helpers-avoid-adapters',
      comment:
        'DRIFT (warn): other module files should not import adapters either. Today: ' +
        'reviews/diff-loader -> adapters/git/diff-parser (a pure parser; move it out of adapters/).',
      severity: 'warn',
      from: {
        path: '^src/modules/',
        pathNot: ['^src/modules/repo-intel/', '^src/modules/[^/]+/(service|run-executor)[^/]*\\.ts$', '^src/modules/[^/]+/routes\\.ts$'],
      },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'db-confined-to-repositories',
      comment:
        'DRIFT (warn): db/schema and drizzle-orm belong in modules/*/repository*. Today 8 files ' +
        'query outside one: routes of polling/pulls/settings/workspace, reviews/run-executor, ' +
        'reviews/diff-loader, repos/helpers, settings/feature-models.',
      severity: 'warn',
      from: { path: '^src/modules/', pathNot: '^src/modules/[^/]+/repository' },
      to: { path: ['^src/db/schema', pkg(['drizzle-orm'])] },
    },
    {
      name: 'no-cross-module-internals',
      comment:
        'DRIFT (warn): one module reaches another through container.*, never its files; ' +
        '_shared is common ground. Today: repos/service -> repo-intel/constants.',
      severity: 'warn',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/([^/]+)/', pathNot: ['^src/modules/$1/', '^src/modules/_shared/'] },
    },
    {
      name: 'no-circular',
      comment:
        'DRIFT (warn): 4 cycles run container.ts -> repo-intel/service (+ its pipeline) -> ' +
        'container type; 1 is agents/helpers <-> agents/repository.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['/dist/', '\\.test\\.ts$'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
