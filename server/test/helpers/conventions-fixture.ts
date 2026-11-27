/**
 * Fixture repo for the conventions extractor tests (server/specs/003-conventions.md):
 * three files the mock git client serves, and the model outputs of two scans.
 * Every snippet that should ground is copied from FILES; the others must be dropped.
 */

export const HEAD = 'c0ffee1234567890c0ffee1234567890c0ffee12';
export const SERVICE_PATH = 'src/modules/users/service.ts';
export const ROUTES_PATH = 'src/modules/users/routes.ts';
/** Ranked samples, best first (what getConventionSamples returns). */
export const SAMPLE_PATHS = [SERVICE_PATH, ROUTES_PATH];

export const FILES: Record<string, string> = {
  [SERVICE_PATH]: [
    "import { NotFoundError } from '../../platform/errors.js';", // 1
    "import type { UsersRepository } from './repository.js';", // 2
    '', // 3
    'export class UsersService {', // 4
    '  constructor(private repo: UsersRepository) {}', // 5
    '', // 6
    '  async get(id: string) {', // 7
    '    const user = await this.repo.findById(id);', // 8
    "    if (!user) throw new NotFoundError('User not found');", // 9
    '    return user;', // 10
    '  }', // 11
    '}', // 12
  ].join('\r\n'), // a Windows checkout with core.autocrlf=true
  [ROUTES_PATH]: [
    "import type { FastifyInstance } from 'fastify';", // 1
    "import type { ZodTypeProvider } from 'fastify-type-provider-zod';", // 2
    "import { UsersService } from './service.js';", // 3
    '', // 4
    'export default async function usersRoutes(appBase: FastifyInstance) {', // 5
    '  const app = appBase.withTypeProvider<ZodTypeProvider>();', // 6
    '  const service = new UsersService(app.container);', // 7
    "  app.get('/users/:id', async (req) => service.get(req.params.id));", // 8
    '}', // 9
  ].join('\n'),
  'tsconfig.json': ['{', '  "compilerOptions": {', '    "strict": true,', '    "noUncheckedIndexedAccess": true', '  }', '}', ''].join('\n'),
};

export const NOT_FOUND_RULE = 'Throw NotFoundError from services when an entity is missing.';
export const STRICT_RULE = 'Enable strict TypeScript with noUncheckedIndexedAccess.';
export const PLUGIN_RULE = 'Export each route module as a default async Fastify plugin.';
export const TYPE_PROVIDER_RULE = 'Build route plugins with app.withTypeProvider<ZodTypeProvider>().';

const NOT_FOUND_SNIPPET =
  "const user = await this.repo.findById(id);\n    if (!user) throw new NotFoundError('User not found');";

/** 6 proposals: 3 grounded (service 8-9, tsconfig 3-4, routes 5), 3 not. */
export const FIRST_SCAN = {
  conventions: [
    { rule: NOT_FOUND_RULE, evidence_path: SERVICE_PATH, evidence_snippet: NOT_FOUND_SNIPPET, confidence: 0.9 },
    {
      rule: STRICT_RULE,
      evidence_path: './tsconfig.json',
      evidence_snippet: '"strict": true,\n"noUncheckedIndexedAccess": true',
      confidence: 85,
    },
    {
      rule: PLUGIN_RULE,
      evidence_path: ROUTES_PATH,
      evidence_snippet: 'export default async function usersRoutes(appBase: FastifyInstance) {',
      confidence: 0.7,
    },
    // Not in the file:
    { rule: 'Cache reads in the service.', evidence_path: SERVICE_PATH, evidence_snippet: 'return this.cache.get(id) ?? null;', confidence: 0.6 },
    // A file that was never sent:
    { rule: 'Log every request.', evidence_path: 'src/app.ts', evidence_snippet: 'app.log.info({ req }, "incoming request");', confidence: 0.5 },
    // A traversal path:
    { rule: 'Read secrets from the environment.', evidence_path: '../../etc/passwd', evidence_snippet: 'root:x:0:0:root:/root:/bin/bash', confidence: 0.4 },
  ],
};

/** Re-scan: re-proposes the accepted and the rejected rule, plus one new rule. */
export const RESCAN = {
  conventions: [
    {
      rule: 'Services throw NotFoundError when an entity is missing.',
      evidence_path: SERVICE_PATH,
      evidence_snippet: NOT_FOUND_SNIPPET,
      confidence: 0.95,
    },
    {
      rule: 'Enable strict TypeScript and noUncheckedIndexedAccess.',
      evidence_path: 'tsconfig.json',
      evidence_snippet: '"noUncheckedIndexedAccess": true',
      confidence: 0.8,
    },
    {
      rule: TYPE_PROVIDER_RULE,
      evidence_path: ROUTES_PATH,
      evidence_snippet: 'const app = appBase.withTypeProvider<ZodTypeProvider>();',
      confidence: 0.75,
    },
  ],
};
