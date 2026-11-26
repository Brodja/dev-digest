import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillsService } from './service.js';
import {
  IMPORT_BODY_LIMIT_BYTES,
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
 *   POST   /skills/import/preview → upload (.md / .zip / .skill, base64) → draft; writes nothing
 *   POST   /skills/import → save the confirmed draft (source = imported_file, disabled)
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

/** The size limit is checked on the decoded bytes in the service (422 too_large);
    the route bodyLimit (413) only stops payloads far past it. */
const ImportPreviewBody = z.object({
  filename: z.string().min(1).max(255),
  content_base64: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, 'content_base64 must be base64'),
});

/** The confirmed draft; source and enabled are set by the server. */
const ImportSkillBody = CreateSkillBody.omit({ enabled: true });

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

  app.post(
    '/skills/import/preview',
    { bodyLimit: IMPORT_BODY_LIMIT_BYTES, schema: { body: ImportPreviewBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.previewImport(workspaceId, req.body);
    },
  );

  app.post('/skills/import', { schema: { body: ImportSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.confirmImport(workspaceId, req.body);
    reply.status(201);
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });
}
