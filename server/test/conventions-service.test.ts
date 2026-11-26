import { describe, it, expect, vi } from 'vitest';
import type { ChatMessage, RepoRef, StructuredRequest, StructuredResult } from '@devdigest/shared';
import { ConventionsService } from '../src/modules/conventions/service.js';
import type { NewConvention, NewScan, DecidedConvention } from '../src/modules/conventions/repository.js';
import type { Container } from '../src/platform/container.js';
import { AppError } from '../src/platform/errors.js';
import { MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import { FILES, FIRST_SCAN, HEAD, SAMPLE_PATHS, SERVICE_PATH } from './helpers/conventions-fixture.js';

/**
 * ConventionsService with stubbed ports and repository (no DB, no network):
 * code picks the files, the model is called once, evidence is grounded by code.
 */

const WS = 'ws-1';
const REPO = {
  id: 'repo-1',
  owner: 'acme',
  name: 'api',
  fullName: 'acme/api',
  defaultBranch: 'main',
  clonePath: '/clones/acme/api',
};

class ThrowingLLM extends MockLLMProvider {
  override async completeStructured<T>(_req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    this.calls.push({ method: 'completeStructured', req: _req });
    throw new Error('upstream 503');
  }
}

/** HEAD moves after the first read: simulates a sync during the scan. */
class MovingHeadGit extends MockGitClient {
  private n = 0;
  override async currentHead(_repo?: RepoRef): Promise<string> {
    return this.n++ === 0 ? 'aaa' : 'bbb';
  }
}

interface SetupOpts {
  samples?: string[];
  llm?: MockLLMProvider;
  git?: MockGitClient;
  repo?: typeof REPO;
  indexReason?: string;
  accepted?: string[];
  decided?: DecidedConvention[];
}

function setup(opts: SetupOpts = {}) {
  const llm = opts.llm ?? new MockLLMProvider('openai', { structuredBySchema: { ConventionExtraction: FIRST_SCAN } });
  const git = opts.git ?? new MockGitClient({ files: FILES, head: HEAD });
  const repoIntel = {
    getConventionSamples: vi.fn(async () => opts.samples ?? SAMPLE_PATHS),
    getIndexState: vi.fn(async () => ({ degradedReason: opts.indexReason })),
  };
  const skills = { create: vi.fn(async (_ws: string, input: unknown, source: string) => ({ id: 's1', input, source })) };
  const container = {
    db: {},
    git,
    repoIntel,
    tokenizer: { count: (s: string) => Math.ceil(s.length / 4) },
    featureModel: vi.fn(async () => ({ provider: 'openai', model: 'cheap-model' })),
    llm: vi.fn(async () => llm),
    skills,
  } as unknown as Container;

  const stored = { rows: [] as NewConvention[], scans: [] as NewScan[], decidedSeen: [] as DecidedConvention[][] };
  const accepted = new Set(opts.accepted ?? []);
  const repo = {
    findRepo: async () => opts.repo ?? REPO,
    decided: async () => opts.decided ?? [],
    list: async () => [],
    latestScan: async () => undefined,
    replacePending: async (
      _ws: string,
      _repoId: string,
      build: (d: DecidedConvention[]) => { rows: NewConvention[]; scan: NewScan },
    ) => {
      const decided = opts.decided ?? [];
      stored.decidedSeen.push(decided);
      const { rows, scan } = build(decided);
      stored.rows.push(...rows);
      stored.scans.push(scan);
    },
    recordScan: async (_ws: string, _repoId: string, scan: NewScan) => {
      stored.scans.push(scan);
    },
    acceptedIds: async (_ws: string, _repoId: string, ids: readonly string[]) => ids.filter((id) => accepted.has(id)),
  };
  const service = new ConventionsService(container);
  (service as unknown as { repo: typeof repo }).repo = repo;
  return { service, container, llm, repoIntel, skills, stored };
}

const structuredCalls = (llm: MockLLMProvider) => llm.calls.filter((c) => c.method === 'completeStructured');

async function expectAppError(p: Promise<unknown>, code: string, status: number) {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  expect((err as AppError).statusCode).toBe(status);
}

describe('ConventionsService.extract', () => {
  it('samples by code, calls the feature model exactly once, and grounds evidence by code', async () => {
    const { service, container, llm, repoIntel, stored } = setup();
    await service.extract(WS, REPO.id);

    expect(repoIntel.getConventionSamples).toHaveBeenCalledWith(REPO.id, 400);
    expect(container.featureModel).toHaveBeenCalledWith(WS, 'conventions');
    expect(container.llm).toHaveBeenCalledWith('openai');
    const calls = structuredCalls(llm);
    expect(calls).toHaveLength(1);
    const req = calls[0]!.req as StructuredRequest<unknown> & { messages: ChatMessage[] };
    expect(req.schemaName).toBe('ConventionExtraction');
    expect(req.model).toBe('cheap-model');
    expect(req.maxRetries).toBe(1);
    expect(req).not.toHaveProperty('maxTokens');

    // What was sent: the config found by name + the ranked samples; nothing else.
    const user = req.messages[1]!.content;
    expect(user).toContain('<untrusted source="file:tsconfig.json">');
    expect(user).toContain(`<untrusted source="file:${SERVICE_PATH}">`);
    expect(user).not.toContain('src/app.ts');
    expect(user).not.toContain('\r'); // CRLF normalised before sending

    // Grounded: 3 of 6; lines from the match, snippet = the file's lines.
    expect(stored.rows.map((r) => [r.rule, r.evidencePath, r.evidenceStartLine, r.evidenceEndLine])).toEqual([
      ['Throw NotFoundError from services when an entity is missing.', SERVICE_PATH, 8, 9],
      ['Enable strict TypeScript with noUncheckedIndexedAccess.', 'tsconfig.json', 3, 4],
      ['Export each route module as a default async Fastify plugin.', 'src/modules/users/routes.ts', 5, 5],
    ]);
    expect(stored.rows[0]!.evidenceSnippet).toBe(
      "    const user = await this.repo.findById(id);\n    if (!user) throw new NotFoundError('User not found');",
    );
    expect(stored.rows[1]!.confidence).toBe(0.85);
    expect(stored.rows.every((r) => r.commitSha === HEAD && r.accepted === false && r.rejected === false)).toBe(true);

    expect(stored.scans).toHaveLength(1);
    expect(stored.scans[0]).toMatchObject({
      status: 'succeeded',
      provider: 'openai',
      model: 'cheap-model',
      commitSha: HEAD,
      files: ['tsconfig.json', ...SAMPLE_PATHS],
      proposed: 6,
      kept: 3,
      droppedUngrounded: 3,
      droppedDuplicate: 0,
      tokensIn: 100,
      tokensOut: 50,
      attempts: 1,
    });
  });

  it('spreads the 12 samples over packages and sends every package’s tsconfig (tied ranks)', async () => {
    // Ranked as the DB returns ties: one package first, the others at the end.
    const ranked = [
      ...Array.from({ length: 20 }, (_, i) => `server/src/${i % 2 ? 'platform' : 'modules/m'}/f${i}.ts`),
      ...Array.from({ length: 5 }, (_, i) => `client/src/app/c${i}.tsx`),
      'reviewer-core/src/prompt.ts',
      'reviewer-core/src/grounding.ts',
    ];
    const files: Record<string, string> = Object.fromEntries(
      ranked.map((p) => [p, `export const value = '${p}';\n`]),
    );
    for (const pkg of ['server', 'client', 'reviewer-core']) files[`${pkg}/tsconfig.json`] = '{ "compilerOptions": { "strict": true } }\n';
    const { service, stored } = setup({ samples: ranked, git: new MockGitClient({ files, head: HEAD }) });
    await service.extract(WS, REPO.id);

    const sent = stored.scans[0]!.files!;
    expect(sent.slice(0, 3)).toEqual(['server/tsconfig.json', 'client/tsconfig.json', 'reviewer-core/tsconfig.json']);
    const samples = sent.slice(3);
    expect(samples).toHaveLength(12);
    const count = (pkg: string) => samples.filter((p) => p.startsWith(`${pkg}/`)).length;
    expect([count('server'), count('client'), count('reviewer-core')]).toEqual([5, 5, 2]);
    // Inside server, both directories are sampled from the start.
    expect(samples.slice(0, 3)).toEqual(['server/src/modules/m/f0.ts', 'client/src/app/c0.tsx', 'reviewer-core/src/prompt.ts']);
    expect(samples[3]).toBe('server/src/platform/f1.ts');
  });

  it('drops a re-proposed decided rule', async () => {
    const { service, stored } = setup({
      decided: [{ rule: 'Throw NotFoundError from services when an entity is missing.', evidencePath: SERVICE_PATH, evidenceStartLine: 8, evidenceEndLine: 9 }],
    });
    await service.extract(WS, REPO.id);
    expect(stored.rows).toHaveLength(2);
    expect(stored.scans[0]).toMatchObject({ kept: 2, droppedDuplicate: 1 });
  });

  it('no samples → 409 repo_not_indexed, no model call, a failed scan is recorded', async () => {
    const { service, llm, stored } = setup({ samples: [], indexReason: 'no_data' });
    await expectAppError(service.extract(WS, REPO.id), 'repo_not_indexed', 409);
    expect(structuredCalls(llm)).toHaveLength(0);
    expect(stored.scans).toEqual([expect.objectContaining({ status: 'failed', errorCode: 'repo_not_indexed' })]);
  });

  it('repo-intel turned off → 409 repo_intel_disabled', async () => {
    const { service } = setup({ samples: [], indexReason: 'flag_off' });
    await expectAppError(service.extract(WS, REPO.id), 'repo_intel_disabled', 409);
  });

  it('no clone → 409 repo_not_cloned', async () => {
    const { service, llm } = setup({ repo: { ...REPO, clonePath: null as unknown as string } });
    await expectAppError(service.extract(WS, REPO.id), 'repo_not_cloned', 409);
    expect(structuredCalls(llm)).toHaveLength(0);
  });

  it('HEAD moving during the scan → 409 repo_changed, no model call', async () => {
    const { service, llm } = setup({ git: new MovingHeadGit({ files: FILES }) });
    await expectAppError(service.extract(WS, REPO.id), 'repo_changed', 409);
    expect(structuredCalls(llm)).toHaveLength(0);
  });

  it('a failing model call → 502 llm_failed and a failed scan with what was sent', async () => {
    const llm = new ThrowingLLM('openai');
    const { service, stored } = setup({ llm });
    await expectAppError(service.extract(WS, REPO.id), 'llm_failed', 502);
    expect(structuredCalls(llm)).toHaveLength(1);
    expect(stored.rows).toHaveLength(0);
    expect(stored.scans[0]).toMatchObject({
      status: 'failed',
      errorCode: 'llm_failed',
      provider: 'openai',
      model: 'cheap-model',
      files: ['tsconfig.json', ...SAMPLE_PATHS],
    });
    expect(stored.scans[0]!.errorMessage).toContain('upstream 503');
  });

  it('degenerate output (every rule a fragment) → 502 llm_bad_output, pending candidates kept', async () => {
    const fragment = { rule: 'Use `', evidence_path: 'tsconfig.json', evidence_snippet: '"noUncheckedIndexedAccess": true', confidence: 1 };
    const llm = new MockLLMProvider('openai', {
      structuredBySchema: { ConventionExtraction: { conventions: Array.from({ length: 12 }, () => fragment) } },
    });
    const { service, stored } = setup({ llm });
    await expectAppError(service.extract(WS, REPO.id), 'llm_bad_output', 502);
    expect(stored.rows).toHaveLength(0); // replacePending never ran
    expect(stored.scans).toEqual([
      expect.objectContaining({ status: 'failed', errorCode: 'llm_bad_output', proposed: 12, droppedUngrounded: 12 }),
    ]);
  });

  it('a second scan of the same repo while one runs → 409 extraction_running', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    class SlowLLM extends MockLLMProvider {
      override async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
        await gate;
        return super.completeStructured(req);
      }
    }
    const { service } = setup({ llm: new SlowLLM('openai', { structuredBySchema: { ConventionExtraction: FIRST_SCAN } }) });
    const first = service.extract(WS, REPO.id);
    await new Promise((r) => setTimeout(r, 10));
    await expectAppError(service.extract(WS, REPO.id), 'extraction_running', 409);
    release();
    await first;
    // The guard is released afterwards.
    await expect(service.extract(WS, REPO.id)).resolves.toBeDefined();
  });
});

describe('ConventionsService.createSkill', () => {
  const input = { name: 'repo-conventions', description: 'Flag broken conventions.', body: '# repo-conventions\n- rule', convention_ids: ['c1', 'c2'] };

  it('saves through container.skills.create with type convention and source extracted', async () => {
    const { service, skills } = setup({ accepted: ['c1', 'c2'] });
    await service.createSkill(WS, REPO.id, input);
    expect(skills.create).toHaveBeenCalledWith(
      WS,
      { name: 'repo-conventions', description: 'Flag broken conventions.', type: 'convention', body: '# repo-conventions\n- rule', enabled: true },
      'extracted',
    );
  });

  it('refuses ids that are not accepted conventions of the repo (422, details.ids)', async () => {
    const { service, skills } = setup({ accepted: ['c1'] });
    const err = await service.createSkill(WS, REPO.id, input).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'conventions_not_accepted', statusCode: 422, details: { ids: ['c2'] } });
    expect(skills.create).not.toHaveBeenCalled();
  });
});
