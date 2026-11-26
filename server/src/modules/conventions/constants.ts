/** Limits and names of the conventions extractor (server/specs/003-conventions.md). */

/** Source files sent to the model, spread over packages (helpers.spreadSamples). */
export const SAMPLE_COUNT = 12;
/**
 * Ranked candidates asked from repoIntel.getConventionSamples before the spread.
 * Large on purpose: with tied ranks the DB returns them in an arbitrary order
 * (measured: the first 60 were 56 client files + 4 .claude scripts, no server),
 * and asking costs one query — no file is read until the 12 are picked.
 */
export const SAMPLE_CANDIDATES = 400;

/** Config files probed by name at the repo root and in first-level dirs of the samples. */
export const CONFIG_FILE_NAMES = [
  'tsconfig.json',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.prettierrc',
  '.prettierrc.json',
  'prettier.config.js',
  'prettier.config.mjs',
  'prettier.config.cjs',
] as const;
export const MAX_CONFIG_FILES = 6;
/** Root + up to this many first-level directories are probed for config files. */
export const MAX_PROBE_DIRS = 4;

/** Per-file prefix sent to the model (cut at a line boundary, so line numbers stay real). */
export const PROMPT_MAX_LINES = 250;
export const PROMPT_MAX_CHARS = 12_000;
/** Whole sample set, counted with container.tokenizer. */
export const PROMPT_TOKEN_BUDGET = 40_000;
/** A line longer than this marks a minified / generated file: skipped. */
export const MAX_LINE_CHARS = 1_000;
/** Decided rules listed in the prompt as "do not propose again". */
export const MAX_DECIDED_IN_PROMPT = 50;

/** Evidence guards (measured on non-whitespace characters / matched file lines). */
export const SNIPPET_MIN_NON_WS = 16;
export const SNIPPET_COMPACT_MIN_NON_WS = 20;
export const SNIPPET_MAX_LINES = 40;

/** Candidates kept per scan, highest confidence first. */
export const MAX_CANDIDATES = 15;
/** Dedupe thresholds (token Jaccard). */
export const DUP_JACCARD = 0.8;
export const DUP_SAME_PLACE_JACCARD = 0.5;

/** PATCH rule length (trimmed). */
export const RULE_MAX = 500;
/**
 * A proposed rule shorter than this, or with fewer content words, is not a
 * rule (seen live: deepseek-v4-flash in json_schema mode returned twelve
 * copies of "Use `" — the string closed right after a backtick).
 */
export const RULE_MIN_CHARS = 15;
export const RULE_MIN_WORDS = 2;
/** POST …/skill: convention ids per request. */
export const SKILL_IDS_MAX = 100;

/** The one model call. */
export const EXTRACTION_SCHEMA_NAME = 'ConventionExtraction';
export const LLM_TIMEOUT_MS = 150_000;
export const LLM_MAX_RETRIES = 1;

/** Per-route limit for POST …/extract (each call is a model call). */
export const EXTRACT_RATE_LIMIT = { max: 5, timeWindow: '1 minute' } as const;

/** Error codes of this module (shared handler shapes the body). */
export const ERR = {
  repoNotCloned: 'repo_not_cloned',
  repoIntelDisabled: 'repo_intel_disabled',
  repoNotIndexed: 'repo_not_indexed',
  repoChanged: 'repo_changed',
  extractionRunning: 'extraction_running',
  llmFailed: 'llm_failed',
  llmBadOutput: 'llm_bad_output',
  notAccepted: 'conventions_not_accepted',
} as const;
