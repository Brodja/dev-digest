import type {
  ConventionCandidate,
  ConventionsState,
  ConventionStatus,
  LLMProvider,
  RepoRef,
  Skill,
  StructuredResult,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import {
  ConventionsRepository,
  type ConventionRepoRecord,
  type DecidedConvention,
  type NewScan,
} from './repository.js';
import { prepareSource } from './evidence.js';
import {
  configCandidates,
  flagsFor,
  groundProposals,
  isUsableSource,
  selectCandidates,
  spreadSamples,
  toConventionDto,
  toScanDto,
  truncateForPrompt,
  type RuleRef,
} from './helpers.js';
import {
  buildExtractionMessages,
  ConventionExtraction,
  type ExtractionPromptInput,
  type PromptFile,
} from './prompt.js';
import {
  ERR,
  EXTRACTION_SCHEMA_NAME,
  LLM_MAX_RETRIES,
  LLM_TIMEOUT_MS,
  MAX_CONFIG_FILES,
  MAX_DECIDED_IN_PROMPT,
  PROMPT_TOKEN_BUDGET,
  SAMPLE_CANDIDATES,
  SAMPLE_COUNT,
} from './constants.js';

/**
 * Conventions extractor (server/specs/003-conventions.md).
 *
 * A scan: code picks the files (repo-intel samples + config files) → ONE
 * structured model call → code grounds every proposal in the exact text the
 * model saw → pending candidates replaced in one transaction. Accepted
 * candidates become a skill through `container.skills.create(…, 'extracted')`.
 */

export interface ConventionUpdate {
  status?: ConventionStatus;
  rule?: string;
}

export interface ConventionSkillInput {
  name: string;
  description: string;
  body: string;
  convention_ids: string[];
}

/** What a scan learned so far — stored on the scan row, also when it fails. */
interface ScanTrail {
  files: string[];
  provider?: string;
  model?: string;
  commitSha?: string | null;
  proposed?: number;
  droppedUngrounded?: number;
  tokensIn?: number;
  tokensOut?: number;
  attempts?: number;
  costUsd?: number | null;
}

interface SourceFile {
  path: string;
  kind: PromptFile['kind'];
  text: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toRuleRef(d: DecidedConvention): RuleRef {
  return {
    rule: d.rule,
    path: d.evidencePath,
    startLine: d.evidenceStartLine,
    endLine: d.evidenceEndLine,
  };
}

function scanFields(trail: ScanTrail): Omit<NewScan, 'status' | 'startedAt'> {
  return {
    provider: trail.provider ?? null,
    model: trail.model ?? null,
    commitSha: trail.commitSha ?? null,
    files: trail.files,
    proposed: trail.proposed ?? 0,
    droppedUngrounded: trail.droppedUngrounded ?? 0,
    tokensIn: trail.tokensIn ?? null,
    tokensOut: trail.tokensOut ?? null,
    attempts: trail.attempts ?? null,
    costUsd: trail.costUsd ?? null,
  };
}

export class ConventionsService {
  private repo: ConventionsRepository;
  /** Repos with a scan in flight. The routes plugin builds one service per app. */
  private running = new Set<string>();

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  async state(workspaceId: string, repoId: string): Promise<ConventionsState> {
    await this.requireRepo(workspaceId, repoId);
    return this.readState(workspaceId, repoId);
  }

  /** POST /repos/:id/conventions/extract — one scan, then the new state. */
  async extract(workspaceId: string, repoId: string): Promise<ConventionsState> {
    const repo = await this.requireRepo(workspaceId, repoId);
    if (this.running.has(repoId)) {
      throw new AppError(ERR.extractionRunning, 'An extraction of this repository is already running', 409);
    }
    this.running.add(repoId);
    const startedAt = new Date();
    const trail: ScanTrail = { files: [] };
    try {
      await this.runScan(workspaceId, repo, startedAt, trail);
    } catch (err) {
      await this.recordFailure(workspaceId, repoId, startedAt, trail, err);
      throw err;
    } finally {
      this.running.delete(repoId);
    }
    return this.readState(workspaceId, repoId);
  }

  async update(
    workspaceId: string,
    repoId: string,
    id: string,
    patch: ConventionUpdate,
  ): Promise<ConventionCandidate> {
    await this.requireRepo(workspaceId, repoId);
    const row = await this.repo.update(workspaceId, repoId, id, {
      ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
      ...(patch.status !== undefined ? flagsFor(patch.status) : {}),
    });
    if (!row?.evidencePath) throw new NotFoundError('Convention not found');
    return toConventionDto(row);
  }

  /**
   * POST /repos/:id/conventions/skill — the user's (edited) draft. Only accepted
   * conventions of this repo may be referenced; the skill is saved through the
   * skills service with type `convention` and source `extracted` (trusted).
   */
  async createSkill(workspaceId: string, repoId: string, input: ConventionSkillInput): Promise<Skill> {
    await this.requireRepo(workspaceId, repoId);
    const ids = [...new Set(input.convention_ids)];
    const accepted = new Set(await this.repo.acceptedIds(workspaceId, repoId, ids));
    const missing = ids.filter((id) => !accepted.has(id));
    if (missing.length > 0) {
      throw new AppError(
        ERR.notAccepted,
        'Only accepted conventions of this repository can go into the skill',
        422,
        { ids: missing },
      );
    }
    return this.container.skills.create(
      workspaceId,
      { name: input.name, description: input.description, type: 'convention', body: input.body, enabled: true },
      'extracted',
    );
  }

  // ---------------------------------------------------------------- scan

  private async runScan(
    workspaceId: string,
    repo: ConventionRepoRecord,
    startedAt: Date,
    trail: ScanTrail,
  ): Promise<void> {
    if (!repo.clonePath) {
      throw new AppError(ERR.repoNotCloned, 'The repository has not been cloned yet', 409);
    }
    const ref: RepoRef = { owner: repo.owner, name: repo.name };
    const headBefore = await this.head(ref);

    // 1. The sample set — chosen by code, before any model call: many ranked
    //    candidates, then SAMPLE_COUNT spread over packages (ranks can be all equal).
    const ranked = await this.container.repoIntel.getConventionSamples(repo.id, SAMPLE_CANDIDATES);
    const samples = spreadSamples(ranked, SAMPLE_COUNT);
    if (samples.length === 0) throw await this.noSamplesError(repo.id);
    const files = await this.collectFiles(ref, samples);
    trail.files = files.map((f) => f.path);
    if (files.length === 0) {
      throw new AppError(ERR.repoNotIndexed, 'None of the sampled files could be read from the clone', 409, {
        reason: 'unreadable',
      });
    }
    const headAfter = await this.head(ref);
    if (headBefore !== headAfter) {
      throw new AppError(ERR.repoChanged, 'The checkout moved while files were being read; run the extraction again', 409);
    }
    trail.commitSha = headAfter;

    // 2. The one model call.
    const choice = await this.container.featureModel(workspaceId, 'conventions');
    trail.provider = choice.provider;
    trail.model = choice.model;
    const llm = await this.container.llm(choice.provider);
    const decidedRules = (await this.repo.decided(workspaceId, repo.id))
      .slice(0, MAX_DECIDED_IN_PROMPT)
      .map((d) => d.rule);
    const res = await this.callModel(llm, choice.model, {
      repoFullName: repo.fullName,
      files,
      decidedRules,
    });
    trail.proposed = res.data.conventions.length;
    trail.tokensIn = res.tokensIn;
    trail.tokensOut = res.tokensOut;
    trail.attempts = res.attempts;
    trail.costUsd = res.costUsd;

    // 3. Evidence checked by code, against the exact text the model saw.
    const { grounded, droppedUngrounded, invalidRules } = groundProposals(
      res.data.conventions,
      new Map(files.map((f) => [f.path, f.text])),
    );
    trail.droppedUngrounded = droppedUngrounded;
    // Degenerate output (every rule a fragment): a model failure, not "nothing
    // found" — keep the current pending candidates instead of replacing them.
    if (res.data.conventions.length > 0 && invalidRules === res.data.conventions.length) {
      throw new AppError(
        ERR.llmBadOutput,
        `The model returned ${invalidRules} unusable rule(s) (fragments, not sentences); run the extraction again`,
        502,
      );
    }

    // 4. Replace pending candidates; dedupe against decided rules read inside the transaction.
    await this.repo.replacePending(workspaceId, repo.id, (decided) => {
      const { kept, droppedDuplicate } = selectCandidates(grounded, decided.map(toRuleRef));
      return {
        rows: kept.map((c) => ({
          rule: c.rule,
          evidencePath: c.path,
          evidenceSnippet: c.snippet,
          evidenceStartLine: c.startLine,
          evidenceEndLine: c.endLine,
          confidence: c.confidence,
          commitSha: headAfter,
          accepted: false,
          rejected: false,
        })),
        scan: {
          ...scanFields(trail),
          status: 'succeeded',
          kept: kept.length,
          droppedDuplicate,
          startedAt,
          finishedAt: new Date(),
        },
      };
    });
  }

  /** Config files (≤ MAX_CONFIG_FILES, root first) + samples in rank order, within the token budget. */
  private async collectFiles(ref: RepoRef, samples: readonly string[]): Promise<PromptFile[]> {
    const samplePaths = [...new Set(samples)];
    const configPaths = configCandidates(samplePaths).filter((p) => !samplePaths.includes(p));
    const [configTexts, sampleTexts] = await Promise.all([
      Promise.all(configPaths.map((p) => this.read(ref, p))),
      Promise.all(samplePaths.map((p) => this.read(ref, p))),
    ]);
    const present = (paths: string[], texts: (string | null)[], kind: SourceFile['kind']): SourceFile[] =>
      paths.flatMap((path, i) => {
        const text = texts[i];
        return text ? [{ path, kind, text }] : [];
      });
    const sources = [
      ...present(configPaths, configTexts, 'config').slice(0, MAX_CONFIG_FILES),
      ...present(samplePaths, sampleTexts, 'sample'),
    ];

    const out: PromptFile[] = [];
    let tokens = 0;
    for (const src of sources) {
      const cut = truncateForPrompt(src.text);
      const cost = this.container.tokenizer.count(cut.text);
      if (tokens + cost > PROMPT_TOKEN_BUDGET) {
        // Samples come in rank order: stop at the first one that does not fit.
        if (src.kind === 'sample') break;
        continue;
      }
      tokens += cost;
      out.push({ path: src.path, kind: src.kind, text: cut.text, totalLines: cut.totalLines, shownLines: cut.shownLines });
    }
    return out;
  }

  /** Read through the GitClient port; unreadable, empty, binary or minified → absent. */
  private async read(ref: RepoRef, path: string): Promise<string | null> {
    try {
      const text = prepareSource(await this.container.git.readFile(ref, path));
      return isUsableSource(text) ? text : null;
    } catch {
      return null;
    }
  }

  private async head(ref: RepoRef): Promise<string | null> {
    try {
      return await this.container.git.currentHead(ref);
    } catch {
      return null;
    }
  }

  private async noSamplesError(repoId: string): Promise<AppError> {
    let reason: string | undefined;
    try {
      reason = (await this.container.repoIntel.getIndexState(repoId)).degradedReason;
    } catch {
      // No state to read: treat as not indexed.
    }
    if (reason === 'flag_off') {
      return new AppError(
        ERR.repoIntelDisabled,
        'Repo intelligence is turned off (REPO_INTEL_ENABLED=false), so there are no files to sample',
        409,
      );
    }
    return new AppError(
      ERR.repoNotIndexed,
      'The repository has no index to sample from: index (or resync) it, then run the extraction again',
      409,
      reason ? { reason } : undefined,
    );
  }

  private async callModel(
    llm: LLMProvider,
    model: string,
    input: ExtractionPromptInput,
  ): Promise<StructuredResult<ConventionExtraction>> {
    try {
      return await llm.completeStructured({
        model,
        schema: ConventionExtraction,
        schemaName: EXTRACTION_SCHEMA_NAME,
        messages: buildExtractionMessages(input),
        timeoutMs: LLM_TIMEOUT_MS,
        maxRetries: LLM_MAX_RETRIES,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ERR.llmFailed, `The model call failed: ${errorMessage(err)}`, 502);
    }
  }

  private async recordFailure(
    workspaceId: string,
    repoId: string,
    startedAt: Date,
    trail: ScanTrail,
    err: unknown,
  ): Promise<void> {
    const known = err instanceof AppError ? err : null;
    try {
      await this.repo.recordScan(workspaceId, repoId, {
        ...scanFields(trail),
        status: 'failed',
        errorCode: known?.code ?? 'internal_error',
        errorMessage: (known?.message ?? 'Unexpected error during the extraction').slice(0, 1000),
        startedAt,
        finishedAt: new Date(),
      });
    } catch {
      // The original error is what the caller needs; a lost failure row is not.
    }
  }

  // ---------------------------------------------------------------- reads

  private async requireRepo(workspaceId: string, repoId: string): Promise<ConventionRepoRecord> {
    const repo = await this.repo.findRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repository not found');
    return repo;
  }

  private async readState(workspaceId: string, repoId: string): Promise<ConventionsState> {
    const [rows, scan] = await Promise.all([
      this.repo.list(workspaceId, repoId),
      this.repo.latestScan(workspaceId, repoId),
    ]);
    return { scan: scan ? toScanDto(scan) : null, candidates: rows.map(toConventionDto) };
  }
}
