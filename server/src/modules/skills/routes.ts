import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillsService } from './service.js';
import {
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_NAME_HINT,
  SKILL_NAME_PATTERN,
} from './constants.js';

/**
 * Skills module (server/specs/002-skills.md).
 *   GET    /skills       → list (workspace-scoped, by name)
 *   GET    /skills/:id   → one skill + the agents that link it (used_by)
 *   POST   /skills       → create (source = manual, v1)
 *   PUT    /skills/:id   → partial update; a changed body bumps the version
 *   DELETE /skills/:id   → delete (links + versions cascade)
 * Linking skills to an agent lives in the agents module (/agents/:id/skills).
 */

const SkillName = z.string().regex(SKILL_NAME_PATTERN, SKILL_NAME_HINT);
const SkillDescription = z.string().trim().min(1).max(SKILL_DESCRIPTION_MAX);
const SkillBody = z
  .string()
  .max(SKILL_BODY_MAX)
  .refine((s) => s.trim().length > 0, 'Body must not be blank');

const CreateSkillBody = z.object({
  name: SkillName,
  description: SkillDescription,
  type: SkillType,
  body: SkillBody,
  enabled: z.boolean().optional(),
});

const UpdateSkillBody = z.object({
  name: SkillName.optional(),
  description: SkillDescription.optional(),
  type: SkillType.optional(),
  body: SkillBody.optional(),
  enabled: z.boolean().optional(),
});

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.create(workspaceId, req.body, 'manual');
    reply.status(201);
    return skill;
  });

  app.put(
    '/skills/:id',
    { schema: { params: IdParams, body: UpdateSkillBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.update(workspaceId, req.params.id, req.body);
      if (!skill) throw new NotFoundError('Skill not found');
      return skill;
    },
  );

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });
}
