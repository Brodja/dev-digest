/** Skill name = kebab-case slug, same rule as SKILL.md (server/specs/002-skills.md). */
export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const SKILL_NAME_HINT =
  'Use a kebab-case slug: a-z, 0-9 and "-", starting with a letter or digit, up to 64 chars';

export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_BODY_MAX = 40_000;

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
