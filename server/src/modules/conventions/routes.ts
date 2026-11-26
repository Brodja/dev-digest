import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ConventionStatus } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { SkillBody, SkillDescription, SkillName } from '../_shared/skill-fields.js';
import { ConventionsService } from './service.js';
import { EXTRACT_RATE_LIMIT, RULE_MAX, SKILL_IDS_MAX } from './constants.js';

/**
 * Conventions extractor (server/specs/003-conventions.md).
 *   GET   /repos/:id/conventions                    → latest scan + candidates
 *   POST  /repos/:id/conventions/extract            → one scan (one model call) → new state
 *   PATCH /repos/:id/conventions/:conventionId      → accept / reject / back to pending, edit rule
 *   POST  /repos/:id/conventions/skill              → skill from accepted ones (convention, extracted)
 */

const ConventionParams = z.object({
  id: z.string().uuid(),
  conventionId: z.string().uuid(),
});

const PatchConventionBody = z
  .object({
    status: ConventionStatus.optional(),
    rule: z.string().trim().min(1).max(RULE_MAX).optional(),
  })
  .refine((b) => b.status !== undefined || b.rule !== undefined, {
    message: 'Provide status or rule',
  });

const CreateConventionSkillBody = z.object({
  name: SkillName,
  description: SkillDescription,
  body: SkillBody,
  convention_ids: z
    .array(z.string().uuid())
    .min(1)
    .max(SKILL_IDS_MAX)
    .refine((ids) => new Set(ids).size === ids.length, 'convention_ids must be unique'),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.state(workspaceId, req.params.id);
  });

  // Each call is a model call: tight per-route limit (as POST /pulls/:id/review).
  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams }, config: { rateLimit: { ...EXTRACT_RATE_LIMIT } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.extract(workspaceId, req.params.id);
    },
  );

  app.patch(
    '/repos/:id/conventions/:conventionId',
    { schema: { params: ConventionParams, body: PatchConventionBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.update(workspaceId, req.params.id, req.params.conventionId, req.body);
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateConventionSkillBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.createSkill(workspaceId, req.params.id, req.body);
      reply.status(201);
      return skill;
    },
  );
}
