import { z } from 'zod';

/**
 * Conformance, Onboarding, Eval, Memory, Conventions, Skills,
 * Agents and their DTOs.
 */

// ---- Conformance ----
export const ConformanceStatus = z.enum(['implemented', 'missing', 'out_of_scope']);
export type ConformanceStatus = z.infer<typeof ConformanceStatus>;

export const ConformanceItem = z.object({
  requirement: z.string(),
  status: ConformanceStatus,
  evidence_file: z.string().nullish(),
  notes: z.string().nullish(),
});
export type ConformanceItem = z.infer<typeof ConformanceItem>;

export const Conformance = z.object({
  spec_id: z.string(),
  spec_title: z.string(),
  items: z.array(ConformanceItem),
  completeness_pct: z.number().min(0).max(100),
});
export type Conformance = z.infer<typeof Conformance>;

// ---- Onboarding ----
export const OnboardingLink = z.object({
  label: z.string(),
  path: z.string(),
});
export type OnboardingLink = z.infer<typeof OnboardingLink>;

export const OnboardingSection = z.object({
  kind: z.string(),
  title: z.string(),
  body: z.string(), // markdown
  diagram: z.string().nullish(), // mermaid
  links: z.array(OnboardingLink),
});
export type OnboardingSection = z.infer<typeof OnboardingSection>;

export const Onboarding = z.object({
  sections: z.array(OnboardingSection),
});
export type Onboarding = z.infer<typeof Onboarding>;

// ---- Eval ----
export const EvalPerTrace = z.object({
  name: z.string(),
  pass: z.boolean(),
  expected: z.unknown(),
  actual: z.unknown(),
});
export type EvalPerTrace = z.infer<typeof EvalPerTrace>;

export const EvalRun = z.object({
  recall: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  citation_accuracy: z.number().min(0).max(1),
  traces_passed: z.number().int(),
  traces_total: z.number().int(),
  duration_ms: z.number().int(),
  cost_usd: z.number().nullable(),
  per_trace: z.array(EvalPerTrace),
});
export type EvalRun = z.infer<typeof EvalRun>;

export const EvalOwnerKind = z.enum(['skill', 'agent']);
export type EvalOwnerKind = z.infer<typeof EvalOwnerKind>;

export const EvalCase = z.object({
  id: z.string(),
  owner_kind: EvalOwnerKind,
  owner_id: z.string(),
  name: z.string(),
  input_diff: z.string(),
  input_files: z.unknown(),
  input_meta: z.unknown(),
  expected_output: z.unknown(),
  notes: z.string().nullish(),
});
export type EvalCase = z.infer<typeof EvalCase>;

// ---- Memory ----
export const MemoryScope = z.enum(['repo', 'global', 'team']);
export type MemoryScope = z.infer<typeof MemoryScope>;

export const MemoryKind = z.enum([
  'decision',
  'convention',
  'preference',
  'fact',
  'learning',
]);
export type MemoryKind = z.infer<typeof MemoryKind>;

export const MemorySource = z.object({
  pr: z.number().int().nullish(),
  context: z.string(),
});
export type MemorySource = z.infer<typeof MemorySource>;

export const MemoryItem = z.object({
  content: z.string(),
  scope: MemoryScope,
  kind: MemoryKind,
  confidence: z.number().min(0).max(1),
  sources: z.array(MemorySource),
});
export type MemoryItem = z.infer<typeof MemoryItem>;

// ---- Skills ----
export const SkillType = z.enum(['rubric', 'convention', 'security', 'custom']);
export type SkillType = z.infer<typeof SkillType>;

// imported_file = uploaded .md / skill archive (server/specs/002-skills.md).
export const SkillSource = z.enum([
  'manual',
  'imported_url',
  'imported_file',
  'extracted',
  'community',
]);
export type SkillSource = z.infer<typeof SkillSource>;

export const Skill = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: SkillType,
  source: SkillSource,
  body: z.string(),
  enabled: z.boolean(),
  version: z.number().int(),
  evidence_files: z.array(z.string()).nullish(),
  /** Derived from `source` (TrustedSkillSource); false → wrapped as untrusted in the prompt. */
  trusted: z.boolean(),
});
export type Skill = z.infer<typeof Skill>;

/** GET /skills/:id — the skill plus the agents that link it. */
export const SkillDetail = Skill.extend({
  used_by: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type SkillDetail = z.infer<typeof SkillDetail>;

/** GET /skills — a skill plus its usage across the workspace (the list card,
    client/specs/004). Rates are 0..1; null when there is nothing to divide by. */
export const SkillListItem = Skill.extend({
  /** Agents of the workspace that link the skill, in any link state. */
  used_by_count: z.number().int(),
  /** Share of the workspace's review runs with a trace whose config.skills holds this skill. */
  pull_rate: z.number().nullable(),
  /** accepted / (accepted + dismissed) findings of those runs. */
  accept_rate: z.number().nullable(),
});
export type SkillListItem = z.infer<typeof SkillListItem>;

/** GET /skills/:id/versions — one body snapshot; every body change adds one
    (client/specs/004-skills-lab-design.md). Name, description and type are not versioned. */
export const SkillVersion = z.object({
  skill_id: z.string(),
  version: z.number().int().positive(),
  body: z.string(),
  created_at: z.string(),
});
export type SkillVersion = z.infer<typeof SkillVersion>;

/** One agent that links a skill (GET /skills/:id/stats). */
export const SkillUsage = z.object({
  agent_id: z.string(),
  agent_name: z.string(),
  agent_enabled: z.boolean(),
  link_enabled: z.boolean(),
  /** 1-based place of this skill among the agent's links, in link (prompt) order. */
  position: z.number().int().positive(),
  /** link_enabled && skill.enabled — the rule a review run uses to send the skill. */
  in_prompt: z.boolean(),
});
export type SkillUsage = z.infer<typeof SkillUsage>;

/** GET /skills/:id/stats — who uses the skill, and how many body versions it has. */
export const SkillStats = z.object({
  skill_id: z.string(),
  version: z.number().int(),
  version_count: z.number().int(),
  used_by_count: z.number().int(),
  in_prompt_count: z.number().int(),
  /** Same as SkillListItem.pull_rate / accept_rate. */
  pull_rate: z.number().nullable(),
  accept_rate: z.number().nullable(),
  agents: z.array(SkillUsage),
});
export type SkillStats = z.infer<typeof SkillStats>;

/** Why a file of an imported archive was left out (it is never run or stored). */
export const IgnoredFileReason = z.enum(['script', 'other']);
export type IgnoredFileReason = z.infer<typeof IgnoredFileReason>;

/**
 * POST /skills/import/preview — what an upload would become. Nothing is stored
 * until the user confirms with POST /skills/import.
 */
export const SkillImportPreview = z.object({
  draft: z.object({
    name: z.string(),
    description: z.string(),
    type: SkillType,
    body: z.string(),
  }),
  origin: z.object({
    filename: z.string(),
    kind: z.enum(['markdown', 'archive']),
    /** The file the core came from: the upload itself, or SKILL.md inside the archive. */
    skill_path: z.string(),
  }),
  ignored: z.array(z.object({ path: z.string(), reason: IgnoredFileReason })),
  warnings: z.array(z.string()),
  /** The workspace already has a skill with draft.name. */
  name_taken: z.boolean(),
});
export type SkillImportPreview = z.infer<typeof SkillImportPreview>;

export const CommunitySkill = z.object({
  name: z.string(),
  repo: z.string(),
  stars: z.number().int(),
  lang: z.string(),
  desc: z.string(),
});
export type CommunitySkill = z.infer<typeof CommunitySkill>;

// ---- Conventions (server/specs/003-conventions.md) ----
/** Derived from the two DB flags (accepted, rejected); never both. */
export const ConventionStatus = z.enum(['pending', 'accepted', 'rejected']);
export type ConventionStatus = z.infer<typeof ConventionStatus>;

/** A candidate the model proposed AND code grounded in a sampled file. */
export const ConventionCandidate = z.object({
  id: z.string(),
  rule: z.string(),
  evidence_path: z.string(),
  /** The file's real lines evidence_start_line..evidence_end_line (not the model's text). */
  evidence_snippet: z.string(),
  confidence: z.number().min(0).max(1),
  /** = status === 'accepted' (kept from the starter contract). */
  accepted: z.boolean(),
  status: ConventionStatus,
  evidence_start_line: z.number().int().positive(),
  evidence_end_line: z.number().int().positive(),
  /** HEAD the evidence was checked against; GitHub links pin it. */
  commit_sha: z.string().nullable(),
  created_at: z.string(),
});
export type ConventionCandidate = z.infer<typeof ConventionCandidate>;

/** One extraction run: what was sent, what code kept or dropped, or why it failed. */
export const ConventionScan = z.object({
  id: z.string(),
  status: z.enum(['succeeded', 'failed']),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  commit_sha: z.string().nullable(),
  /** Repo-relative paths sent to the model (samples + config files). */
  files: z.array(z.string()),
  proposed: z.number().int(),
  kept: z.number().int(),
  dropped_ungrounded: z.number().int(),
  dropped_duplicate: z.number().int(),
  tokens_in: z.number().int().nullable(),
  tokens_out: z.number().int().nullable(),
  attempts: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
  started_at: z.string(),
  finished_at: z.string(),
});
export type ConventionScan = z.infer<typeof ConventionScan>;

/** GET /repos/:id/conventions and POST /repos/:id/conventions/extract. */
export const ConventionsState = z.object({
  scan: ConventionScan.nullable(),
  candidates: z.array(ConventionCandidate),
});
export type ConventionsState = z.infer<typeof ConventionsState>;

// ---- Agents ----
export const Provider = z.enum(['openai', 'anthropic', 'openrouter']);
export type Provider = z.infer<typeof Provider>;

// Review execution strategy (matches @devdigest/reviewer-core's ReviewStrategy):
//  - single-pass: send the WHOLE diff in ONE model call (default)
//  - map-reduce:  one model call PER changed file (for very large diffs)
//  - auto:        single-pass, switching to map-reduce when the diff is large
export const ReviewStrategy = z.enum(['single-pass', 'map-reduce', 'auto']);
export type ReviewStrategy = z.infer<typeof ReviewStrategy>;

// CI gate policy — when a CI review should BLOCK (REQUEST_CHANGES + fail the
// check) vs just comment. Deterministic from severities; acted on ONLY in CI.
export const CiFailOn = z.enum(['never', 'critical', 'warning', 'any']);
export type CiFailOn = z.infer<typeof CiFailOn>;

export const Agent = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provider: Provider,
  model: z.string(),
  system_prompt: z.string(),
  output_schema: z.unknown().nullish(),
  enabled: z.boolean(),
  version: z.number().int(),
  strategy: ReviewStrategy.default('single-pass'),
  ci_fail_on: CiFailOn.default('critical'),
  // Inject repo-intel context (repo skeleton + callers + rank note) into this
  // agent's review prompt. Default on; gated again by the global flag.
  repo_intel: z.boolean().default(true),
});
export type Agent = z.infer<typeof Agent>;

/** GET /agents — an agent plus how many skills it links (agent_skills rows, any link state). */
export const AgentListItem = Agent.extend({
  skill_count: z.number().int(),
});
export type AgentListItem = z.infer<typeof AgentListItem>;

export const AgentSkillLink = z.object({
  agent_id: z.string(),
  skill_id: z.string(),
  order: z.number().int(),
  /** Per-agent switch; the skill reaches the prompt only if this AND Skill.enabled. */
  enabled: z.boolean(),
});
export type AgentSkillLink = z.infer<typeof AgentSkillLink>;
