import type { Skill, SkillDetail, SkillImportPreview, SkillSource, SkillType } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { SkillsRepository } from './repository.js';
import { skillNameTakenError, toSkillDetailDto, toSkillDto } from './helpers.js';
import { IMPORT_MAX_ENTRIES, IMPORT_MAX_FILE_BYTES, SKILL_MD_MAX_BYTES } from './constants.js';
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

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = new SkillsRepository(container.db);
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

  /**
   * POST /skills/import/preview — what the upload would become. Writes NOTHING
   * (no row, no file): the archive stays in memory, only its SKILL.md is
   * unpacked, every other entry is listed by path and never run or stored.
   */
  async previewImport(workspaceId: string, upload: SkillUpload): Promise<SkillImportPreview> {
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
    const archive = this.container.archive;
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
