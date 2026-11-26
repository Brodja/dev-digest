import type { Skill, SkillDetail, SkillSource, SkillType } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { SkillsRepository } from './repository.js';
import { skillNameTakenError, toSkillDetailDto, toSkillDto } from './helpers.js';

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

export class SkillsService {
  private repo: SkillsRepository;

  constructor(container: Container) {
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
}
