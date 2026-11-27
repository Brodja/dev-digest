import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { SkillBody, SkillDescription, SkillName } from '../_shared/skill-fields.js';
import { NotFoundError } from '../../platform/errors.js';
import { IMPORT_BODY_LIMIT_BYTES } from './constants.js';

/**
 * Skills module (server/specs/002-skills.md).
 *   GET    /skills       → list (workspace-scoped, by name) + used_by_count, pull_rate, accept_rate
 *   GET    /skills/:id   → one skill + the agents that link it (used_by)
 *   POST   /skills       → create (source = manual, v1)
 *   PUT    /skills/:id   → partial update; a changed body bumps the version
 *   DELETE /skills/:id   → delete (links + versions cascade)
 *   POST   /skills/import/preview → upload (.md / .zip / .skill, base64) → draft; writes nothing
 *   POST   /skills/import → save the confirmed draft (source = imported_file, disabled)
 *   GET    /skills/:id/versions → body history, newest first (client/specs/004)
 *   POST   /skills/:id/restore  → { version } → that body becomes the next version
 *   GET    /skills/:id/stats    → agents that link it + version count
 * Linking skills to an agent lives in the agents module (/agents/:id/skills).
 */

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

const RestoreBody = z.object({
  version: z.number().int().positive(),
});

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = app.container.skills;

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

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.listVersions(workspaceId, req.params.id);
  });

  app.post(
    '/skills/:id/restore',
    { schema: { params: IdParams, body: RestoreBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.restore(workspaceId, req.params.id, req.body.version);
    },
  );

  app.get('/skills/:id/stats', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.stats(workspaceId, req.params.id);
  });
}
