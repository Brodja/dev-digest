/** Field rules live in _shared (the conventions extractor validates skills too). */
export {
  SKILL_NAME_PATTERN,
  SKILL_NAME_HINT,
  SKILL_DESCRIPTION_MAX,
  SKILL_BODY_MAX,
} from '../_shared/skill-fields.js';

export const INITIAL_SKILL_VERSION = 1;

/** Unique index on skills(workspace_id, name) — see db/schema/skills.ts. */
export const SKILL_NAME_UNIQUE_INDEX = 'skills_workspace_name_uq';

// ---- Import (POST /skills/import/preview) ----
/** Uploaded file, decoded. */
export const IMPORT_MAX_FILE_BYTES = 1_048_576;
/** base64 of IMPORT_MAX_FILE_BYTES; the route bodyLimit leaves room for JSON. */
export const IMPORT_MAX_BASE64_CHARS = Math.ceil(IMPORT_MAX_FILE_BYTES / 3) * 4;
export const IMPORT_BODY_LIMIT_BYTES = 2 * 1_048_576;
export const IMPORT_MAX_ENTRIES = 200;
/** SKILL.md unpacked. */
export const SKILL_MD_MAX_BYTES = 256 * 1024;
/** Name used when nothing in the upload gives one. */
export const IMPORT_FALLBACK_NAME = 'imported-skill';

/** Entries reported as `script`: executable or source files (never run, never stored). */
export const SCRIPT_EXTENSIONS = [
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'bat', 'cmd', 'vbs',
  'py', 'js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx', 'rb', 'pl', 'php', 'lua', 'go', 'rs',
  'java', 'jar', 'class', 'exe', 'dll', 'so', 'dylib', 'bin', 'wasm', 'msi', 'apk', 'app',
] as const;
