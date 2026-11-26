import { and, asc, desc, eq, inArray, isNotNull, or } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { ConventionRow, ConventionScanRow } from '../../db/rows.js';

/**
 * Conventions data access (server/specs/003-conventions.md). Owns `conventions`
 * and `convention_scans`; reads `repos` for the repo it scans. Workspace-scoped
 * throughout. The only file of the module that touches drizzle.
 */

export type { ConventionRow, ConventionScanRow };

export interface ConventionRepoRecord {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  clonePath: string | null;
}

export type NewConvention = Omit<typeof t.conventions.$inferInsert, 'id' | 'workspaceId' | 'repoId' | 'createdAt'>;
export type NewScan = Omit<typeof t.conventionScans.$inferInsert, 'id' | 'workspaceId' | 'repoId'>;

/** An accepted or rejected candidate, as the dedupe and the prompt need it. */
export interface DecidedConvention {
  rule: string;
  evidencePath: string | null;
  evidenceStartLine: number | null;
  evidenceEndLine: number | null;
}

export interface ConventionPatch {
  rule?: string;
  accepted?: boolean;
  rejected?: boolean;
}

export class ConventionsRepository {
  constructor(private db: Db) {}

  async findRepo(workspaceId: string, repoId: string): Promise<ConventionRepoRecord | undefined> {
    const [row] = await this.db
      .select({
        id: t.repos.id,
        owner: t.repos.owner,
        name: t.repos.name,
        fullName: t.repos.fullName,
        defaultBranch: t.repos.defaultBranch,
        clonePath: t.repos.clonePath,
      })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row;
  }

  /**
   * Candidates with evidence: pending, then accepted, then rejected; by confidence.
   * Rows of one scan share created_at and often confidence (a model may answer 1.0
   * for all), so rule + id break ties — otherwise cards reorder on every refetch.
   */
  async list(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          isNotNull(t.conventions.evidencePath),
          isNotNull(t.conventions.evidenceStartLine),
        ),
      )
      .orderBy(
        asc(t.conventions.rejected),
        asc(t.conventions.accepted),
        desc(t.conventions.confidence),
        asc(t.conventions.createdAt),
        asc(t.conventions.rule),
        asc(t.conventions.id),
      );
  }

  async getById(workspaceId: string, repoId: string, id: string): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.id, id),
        ),
      );
    return row;
  }

  async latestScan(workspaceId: string, repoId: string): Promise<ConventionScanRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventionScans)
      .where(and(eq(t.conventionScans.workspaceId, workspaceId), eq(t.conventionScans.repoId, repoId)))
      .orderBy(desc(t.conventionScans.startedAt))
      .limit(1);
    return row;
  }

  /** Accepted + rejected candidates, newest first. */
  async decided(workspaceId: string, repoId: string, db: Pick<Db, 'select'> = this.db): Promise<DecidedConvention[]> {
    return db
      .select({
        rule: t.conventions.rule,
        evidencePath: t.conventions.evidencePath,
        evidenceStartLine: t.conventions.evidenceStartLine,
        evidenceEndLine: t.conventions.evidenceEndLine,
      })
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          or(eq(t.conventions.accepted, true), eq(t.conventions.rejected, true)),
        ),
      )
      .orderBy(desc(t.conventions.createdAt));
  }

  /**
   * Replace the repo's pending candidates, in one transaction: lock the repo row
   * (scans of one repo run one after another), delete pending, re-read the
   * decided rules (one may have been accepted during the model call), let
   * `build` dedupe against them, insert its rows and the scan row.
   */
  async replacePending(
    workspaceId: string,
    repoId: string,
    build: (decided: DecidedConvention[]) => { rows: NewConvention[]; scan: NewScan },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: t.repos.id })
        .from(t.repos)
        .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)))
        .for('update');
      await tx
        .delete(t.conventions)
        .where(
          and(
            eq(t.conventions.workspaceId, workspaceId),
            eq(t.conventions.repoId, repoId),
            eq(t.conventions.accepted, false),
            eq(t.conventions.rejected, false),
          ),
        );
      const { rows, scan } = build(await this.decided(workspaceId, repoId, tx));
      if (rows.length > 0) {
        await tx.insert(t.conventions).values(rows.map((r) => ({ ...r, workspaceId, repoId })));
      }
      await tx.insert(t.conventionScans).values({ ...scan, workspaceId, repoId });
    });
  }

  /** A failed scan: stored so the page can show the reason after a reload. */
  async recordScan(workspaceId: string, repoId: string, scan: NewScan): Promise<void> {
    await this.db.insert(t.conventionScans).values({ ...scan, workspaceId, repoId });
  }

  async update(
    workspaceId: string,
    repoId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionRow | undefined> {
    const changes = {
      ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
      ...(patch.accepted !== undefined ? { accepted: patch.accepted } : {}),
      ...(patch.rejected !== undefined ? { rejected: patch.rejected } : {}),
    };
    // drizzle rejects an empty SET ("No values to set"): nothing to write → read.
    if (Object.keys(changes).length === 0) return this.getById(workspaceId, repoId, id);
    const [row] = await this.db
      .update(t.conventions)
      .set(changes)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.id, id),
        ),
      )
      .returning();
    return row;
  }

  /** The subset of `ids` that are accepted conventions of this repo. */
  async acceptedIds(workspaceId: string, repoId: string, ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ id: t.conventions.id })
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.accepted, true),
          inArray(t.conventions.id, [...ids]),
        ),
      );
    return rows.map((r) => r.id);
  }
}
