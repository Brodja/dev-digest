import type {
  ArchiveReader,
  Skill,
  SkillDetail,
  SkillImportPreview,
  SkillSource,
  SkillStats,
  SkillType,
  SkillVersion,
} from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillsRepository } from './repository.js';
import {
  skillNameTakenError,
  toSkillDetailDto,
  toSkillDto,
  toSkillStatsDto,
  toSkillVersionDto,
} from './helpers.js';
import {
  IMPORT_MAX_BASE64_CHARS,
  IMPORT_MAX_ENTRIES,
  IMPORT_MAX_FILE_BYTES,
  SKILL_MD_MAX_BYTES,
} from './constants.js';
import {
  buildPreview,
  classifyIgnored,
  decodeUtf8,
  detectKind,
  importError,
  pickSkillEntry,
  type IgnoredFile,
} from './import-parser.js';

/**
 * Skills service — the knowledge layer of reviewer agents
 * (server/specs/002-skills.md). A skill = name + type + directive description
 * + markdown body; linked to agents in the agents module.
 */

export interface SkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled?: boolean;
}

export type SkillPatch = Partial<SkillInput>;

export interface SkillUpload {
  filename: string;
  /** The file's bytes, base64 (no data: prefix). */
  content_base64: string;
}

/**
 * What the service needs. Structural on purpose: the composition root passes
 * itself (`container.skills`), and this file never imports `Container`, so the
 * container can build the service without a dependency cycle. `archive` is read
 * at call time, so a test override on the container still applies.
 */
export interface SkillsDeps {
  readonly db: Db;
  readonly archive: ArchiveReader;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private deps: SkillsDeps) {
    this.repo = new SkillsRepository(deps.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map(toSkillDto);
  }

  async get(workspaceId: string, id: string): Promise<SkillDetail | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) return undefined;
    return toSkillDetailDto(row, await this.repo.usedBy(row.id));
  }

  /**
   * Create a skill. `source` is decided by the CALLER (route / feature), never
   * by a request body: POST /skills → 'manual', POST /skills/import →
   * 'imported_file', the conventions extractor → 'extracted'. Trust follows it.
   */
  async create(workspaceId: string, input: SkillInput, source: SkillSource): Promise<Skill> {
    if (await this.repo.nameTaken(workspaceId, input.name)) throw skillNameTakenError(input.name);
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      body: input.body,
      source,
      enabled: input.enabled,
    });
    return toSkillDto(row);
  }

  async update(workspaceId: string, id: string, patch: SkillPatch): Promise<Skill | undefined> {
    if (patch.name !== undefined && (await this.repo.nameTaken(workspaceId, patch.name, id))) {
      throw skillNameTakenError(patch.name);
    }
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? toSkillDto(row) : undefined;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /** Body history, newest first (client/specs/004-skills-lab-design.md). */
  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[]> {
    await this.requireSkill(workspaceId, id);
    const rows = await this.repo.listVersions(id);
    return rows.map(toSkillVersionDto);
  }

  /** Bring an old body back as the next version (same body as now → unchanged). */
  async restore(workspaceId: string, id: string, version: number): Promise<Skill> {
    const result = await this.repo.restoreVersion(workspaceId, id, version);
    if (result.status === 'skill_not_found') throw new NotFoundError('Skill not found');
    if (result.status === 'version_not_found') {
      throw new NotFoundError(`Skill version ${version} not found`, { version });
    }
    return toSkillDto(result.row);
  }

  /** Which agents link the skill, and how many body versions it has. */
  async stats(workspaceId: string, id: string): Promise<SkillStats> {
    const skill = await this.requireSkill(workspaceId, id);
    const [versionCount, usage] = await Promise.all([
      this.repo.countVersions(id),
      this.repo.usage(workspaceId, id),
    ]);
    return toSkillStatsDto(skill, versionCount, usage);
  }

  private async requireSkill(workspaceId: string, id: string) {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) throw new NotFoundError('Skill not found');
    return row;
  }

  /**
   * POST /skills/import/preview — what the upload would become. Writes NOTHING
   * (no row, no file): the archive stays in memory, only its SKILL.md is
   * unpacked, every other entry is listed by path and never run or stored.
   */
  async previewImport(workspaceId: string, upload: SkillUpload): Promise<SkillImportPreview> {
    // Refuse an oversized upload before decoding it; the decoded size is
    // checked again below (padding makes the base64 length an upper bound).
    if (upload.content_base64.length > IMPORT_MAX_BASE64_CHARS) {
      throw importError('too_large', 'The file is over 1 MB');
    }
    const bytes = new Uint8Array(Buffer.from(upload.content_base64, 'base64'));
    if (bytes.length === 0) throw importError('unsupported_file', 'The file is empty');
    if (bytes.length > IMPORT_MAX_FILE_BYTES) throw importError('too_large', 'The file is over 1 MB');

    const kind = detectKind(upload.filename, bytes);
    const { text, skillPath, ignored } =
      kind === 'markdown'
        ? { text: decodeUtf8(bytes), skillPath: upload.filename, ignored: [] as IgnoredFile[] }
        : this.readArchive(bytes);

    const preview = buildPreview({ filename: upload.filename, kind, skillPath, text, ignored });
    return { ...preview, name_taken: await this.repo.nameTaken(workspaceId, preview.draft.name) };
  }

  /**
   * POST /skills/import — the user confirmed the (possibly edited) draft. The
   * source is always imported_file (untrusted for good) and the skill starts
   * disabled until the user has read it and turns it on.
   */
  async confirmImport(workspaceId: string, input: SkillInput): Promise<Skill> {
    return this.create(workspaceId, { ...input, enabled: false }, 'imported_file');
  }

  private readArchive(bytes: Uint8Array): { text: string; skillPath: string; ignored: IgnoredFile[] } {
    const archive = this.deps.archive;
    let entries;
    try {
      entries = archive.entries(bytes);
    } catch {
      throw importError('unsupported_file', 'The archive could not be read (corrupt or unsupported zip)');
    }
    if (entries.length > IMPORT_MAX_ENTRIES) {
      throw importError('too_many_entries', `The archive has ${entries.length} files; the limit is ${IMPORT_MAX_ENTRIES}`);
    }
    const skillPath = pickSkillEntry(entries);
    let read;
    try {
      read = archive.read(bytes, skillPath, SKILL_MD_MAX_BYTES);
    } catch {
      throw importError('unsupported_file', `${skillPath} could not be unpacked`);
    }
    if (!read.ok) {
      throw read.reason === 'too_large'
        ? importError('too_large', `${skillPath} is over ${SKILL_MD_MAX_BYTES / 1024} KB unpacked`)
        : importError('no_skill_md', `${skillPath} could not be found in the archive`);
    }
    return { text: decodeUtf8(read.bytes), skillPath, ignored: classifyIgnored(entries, skillPath) };
  }
}
