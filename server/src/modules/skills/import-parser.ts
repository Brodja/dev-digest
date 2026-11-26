/**
 * Skill import — pure parsing (server/specs/002-skills.md, "Import"). No I/O:
 * the archive is read through the ArchiveReader port by the service; this file
 * decides what the upload is, which entry is the skill, what is ignored, and
 * what the draft looks like. Every refusal is a 422 `import_invalid` with a
 * `details.reason`.
 */
import { SkillType, type ArchiveEntry, type IgnoredFileReason, type SkillImportPreview } from '@devdigest/shared';
import { AppError } from '../../platform/errors.js';
import { IMPORT_FALLBACK_NAME, SCRIPT_EXTENSIONS, SKILL_BODY_MAX, SKILL_DESCRIPTION_MAX } from './constants.js';

export type ImportFailure =
  | 'unsupported_file'
  | 'no_skill_md'
  | 'multiple_skill_md'
  | 'too_large'
  | 'too_many_entries'
  | 'not_utf8';

export function importError(reason: ImportFailure, message: string): AppError {
  return new AppError('import_invalid', message, 422, { reason });
}

export type UploadKind = 'markdown' | 'archive';

export interface IgnoredFile {
  path: string;
  reason: IgnoredFileReason;
}

const basename = (path: string) => path.split('/').pop() ?? path;
const depth = (path: string) => path.split('/').length;

function extensionOf(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function stemOf(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Local file header ("PK\x03\x04") or an empty archive ("PK\x05\x06"). */
export function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06))
  );
}

/** The extension and the content must agree: a .md that is a zip (or the reverse) is refused. */
export function detectKind(filename: string, bytes: Uint8Array): UploadKind {
  const ext = extensionOf(filename);
  const zip = isZip(bytes);
  if (ext === 'zip' || ext === 'skill') {
    if (!zip) throw importError('unsupported_file', `${filename} is not a zip archive`);
    return 'archive';
  }
  if (ext === 'md' || ext === 'markdown') {
    if (zip) throw importError('unsupported_file', `${filename} is named like markdown but is an archive`);
    return 'markdown';
  }
  throw importError('unsupported_file', 'Upload a .md file or a .zip / .skill archive');
}

/** Strict UTF-8, no BOM, LF line endings. */
export function decodeUtf8(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw importError('not_utf8', 'The skill file is not valid UTF-8 text');
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replace(/\r\n?/g, '\n');
}

/** The core is the SKILL.md (any case) closest to the archive root; one at that depth. */
export function pickSkillEntry(entries: ArchiveEntry[]): string {
  const candidates = entries.filter((e) => basename(e.path).toLowerCase() === 'skill.md');
  if (candidates.length === 0) throw importError('no_skill_md', 'The archive has no SKILL.md');
  const top = Math.min(...candidates.map((e) => depth(e.path)));
  const atTop = candidates.filter((e) => depth(e.path) === top);
  if (atTop.length > 1) {
    throw importError(
      'multiple_skill_md',
      `The archive holds several skills (${atTop.map((e) => e.path).join(', ')}); import one at a time`,
    );
  }
  return atTop[0]!.path;
}

function isScript(path: string): boolean {
  const dirs = path.toLowerCase().split('/').slice(0, -1);
  if (dirs.includes('scripts')) return true;
  return (SCRIPT_EXTENSIONS as readonly string[]).includes(extensionOf(path));
}

/** Every entry but the core — listed by path only, never unpacked, run or stored. */
export function classifyIgnored(entries: ArchiveEntry[], corePath: string): IgnoredFile[] {
  return entries
    .filter((e) => e.path !== corePath)
    .map((e) => ({ path: e.path, reason: isScript(e.path) ? 'script' : 'other' }));
}

// ---- SKILL.md ----

export interface ParsedSkillFile {
  name?: string;
  description?: string;
  type?: string;
  body: string;
  /** Top-level frontmatter keys other than name / description / type. */
  ignoredKeys: string[];
}

const KNOWN_KEYS = new Set(['name', 'description', 'type']);
const KEY_LINE = /^([A-Za-z_][\w-]*)\s*:(?:\s+(.*)|\s*)$/;
const isIndented = (line: string) => line.length === 0 || /^\s/.test(line);

function unquote(raw: string): string {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replaceAll("''", "'");
  return raw;
}

/** Block scalar: `|` keeps line breaks, `>` folds lines into one paragraph. */
function blockScalar(lines: string[], literal: boolean): string {
  const indents = lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length);
  const cut = indents.length > 0 ? Math.min(...indents) : 0;
  const text = lines.map((l) => l.slice(cut));
  if (literal) return text.join('\n').trim();
  return text
    .join('\n')
    .split(/\n{2,}/)
    .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' '))
    .join('\n')
    .trim();
}

/**
 * Minimal YAML frontmatter reader: top-level `key: value` with plain, quoted,
 * folded (`>`) or literal (`|`) values. Nested maps / lists under other keys
 * are skipped. No YAML dependency on purpose — only name / description / type
 * are used.
 */
function readFrontmatter(src: string): { values: Map<string, string>; keys: string[] } {
  const values = new Map<string, string>();
  const keys: string[] = [];
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const m = KEY_LINE.exec(lines[i]!);
    i++;
    if (!m) continue;
    const key = m[1]!;
    const raw = (m[2] ?? '').trim();
    const cont: string[] = [];
    while (i < lines.length && isIndented(lines[i]!)) cont.push(lines[i++]!);
    keys.push(key);
    let value: string;
    if (/^[>|][+-]?$/.test(raw)) value = blockScalar(cont, raw.startsWith('|'));
    else if (raw) value = unquote([raw, ...cont.map((l) => l.trim()).filter(Boolean)].join(' '));
    else value = ''; // nested map / list — not a string we use
    values.set(key, value);
  }
  return { values, keys };
}

export function parseSkillFile(text: string): ParsedSkillFile {
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return { body: text.trim(), ignoredKeys: [] };
  const { values, keys } = readFrontmatter(m[1]!);
  const get = (k: string) => (values.get(k) || undefined)?.trim() || undefined;
  return {
    name: get('name'),
    description: get('description'),
    type: get('type'),
    body: text.slice(m[0].length).trim(),
    ignoredKeys: [...new Set(keys.filter((k) => !KNOWN_KEYS.has(k)))],
  };
}

/** kebab-case slug for the skill name (same shape as the SKILL.md name rule). */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
}

const firstHeading = (body: string) => /^#{1,6}\s+(.+)$/m.exec(body)?.[1]?.trim();

/**
 * The draft + what the preview shows. Name: frontmatter → the folder holding
 * SKILL.md → the file name (not "SKILL") → the first heading → a fallback.
 */
export function buildPreview(args: {
  filename: string;
  kind: UploadKind;
  skillPath: string;
  text: string;
  ignored: IgnoredFile[];
}): Omit<SkillImportPreview, 'name_taken'> {
  const parsed = parseSkillFile(args.text);
  if (parsed.body.length > SKILL_BODY_MAX) {
    throw importError('too_large', `The skill body is over ${SKILL_BODY_MAX} characters`);
  }

  const dirs = args.skillPath.split('/').slice(0, -1);
  const folder = dirs.at(-1);
  const fileStem = stemOf(args.kind === 'archive' ? args.filename : args.skillPath);
  const candidates = [
    parsed.name,
    folder,
    fileStem.toLowerCase() === 'skill' ? undefined : fileStem,
    firstHeading(parsed.body),
  ];
  const name = candidates.map((c) => (c ? slugify(c) : '')).find(Boolean) ?? IMPORT_FALLBACK_NAME;

  const typeResult = SkillType.safeParse(parsed.type);
  const description = parsed.description ?? '';

  const warnings: string[] = [];
  if (!description) warnings.push('No description found — write a directive one before saving.');
  else if (description.length > SKILL_DESCRIPTION_MAX)
    warnings.push(`The description is over ${SKILL_DESCRIPTION_MAX} characters — shorten it before saving.`);
  if (!parsed.body) warnings.push('SKILL.md has no body.');
  if (parsed.ignoredKeys.length > 0) warnings.push(`Frontmatter keys ignored: ${parsed.ignoredKeys.join(', ')}.`);
  const base = dirs.length > 0 ? `${dirs.join('/')}/` : '';
  const referenced = args.ignored
    .map((f) => (f.path.startsWith(base) ? f.path.slice(base.length) : f.path))
    .filter((rel) => parsed.body.includes(rel));
  if (referenced.length > 0) {
    warnings.push(`The body refers to files that are not imported: ${referenced.join(', ')}.`);
  }

  return {
    draft: {
      name,
      description,
      type: typeResult.success ? typeResult.data : 'custom',
      body: parsed.body,
    },
    origin: { filename: args.filename, kind: args.kind, skill_path: args.skillPath },
    ignored: args.ignored,
    warnings,
  };
}
