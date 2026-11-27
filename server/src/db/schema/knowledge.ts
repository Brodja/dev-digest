import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  doublePrecision,
  boolean,
  integer,
  vector,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { now } from './_shared';
import { workspaces } from './core';
import { repos } from './repos';

// ============================================================ Knowledge / RAG

export const memory = pgTable(
  'memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'cascade' }),
    scope: text('scope', { enum: ['repo', 'global', 'team'] }).notNull(),
    kind: text('kind', {
      enum: ['decision', 'convention', 'preference', 'fact', 'learning'],
    }).notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    confidence: doublePrecision('confidence'),
    sources: jsonb('sources'),
    createdAt: now(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({ wsIdx: index('memory_ws_idx').on(t.workspaceId) }),
);

/**
 * Convention candidates of a repo (server/specs/003-conventions.md). Status is
 * two flags — pending (false,false), accepted (true,false), rejected (false,true)
 * — never both; the API derives `status`. Lines and snippet are computed by code
 * from the matched evidence, never taken from the model.
 */
export const conventions = pgTable(
  'conventions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'cascade' }),
    rule: text('rule').notNull(),
    evidencePath: text('evidence_path'),
    evidenceSnippet: text('evidence_snippet'),
    confidence: doublePrecision('confidence'),
    accepted: boolean('accepted').notNull().default(false),
    rejected: boolean('rejected').notNull().default(false),
    evidenceStartLine: integer('evidence_start_line'),
    evidenceEndLine: integer('evidence_end_line'),
    /** HEAD the evidence was checked against (GitHub links pin it). */
    commitSha: text('commit_sha'),
    createdAt: now(),
  },
  (t) => ({
    wsRepoIdx: index('conventions_ws_repo_idx').on(t.workspaceId, t.repoId),
    decisionCk: check('conventions_decision_ck', sql`NOT (${t.accepted} AND ${t.rejected})`),
  }),
);

/**
 * One extraction run per row (specs/003): succeeded or failed, with what was
 * sent to the model and how many candidates code kept or dropped. The page
 * reads only the latest row of a repo.
 */
export const conventionScans = pgTable(
  'convention_scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['succeeded', 'failed'] }).notNull(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    provider: text('provider'),
    model: text('model'),
    commitSha: text('commit_sha'),
    /** The sample set: repo-relative paths sent to the model. */
    files: jsonb('files').$type<string[]>().notNull().default([]),
    proposed: integer('proposed').notNull().default(0),
    kept: integer('kept').notNull().default(0),
    droppedUngrounded: integer('dropped_ungrounded').notNull().default(0),
    droppedDuplicate: integer('dropped_duplicate').notNull().default(0),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    attempts: integer('attempts'),
    costUsd: doublePrecision('cost_usd'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ repoStartedIdx: index('convention_scans_repo_started_idx').on(t.repoId, t.startedAt) }),
);
