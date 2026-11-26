/* hooks/conventions.ts — React Query hooks for the Conventions page
   (server/specs/003-conventions.md, client/specs/004): latest scan + candidates,
   run a scan, accept / reject / edit a candidate (one or all at once), build a
   skill from the accepted ones. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { LOCAL_ERROR_TOAST } from "../mutation-meta";
import type { ConventionCandidate, ConventionStatus, ConventionsState, Skill } from "@devdigest/shared";

export function useConventions(repoId: string, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["conventions", repoId],
    queryFn: () => api.get<ConventionsState>(`/repos/${repoId}/conventions`),
    enabled: (opts.enabled ?? true) && !!repoId,
  });
}

/**
 * One scan = one model call. The page shows the failure itself (banner), so no
 * global toast; a failed scan is stored by the server, hence the refetch.
 */
export function useExtractConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: LOCAL_ERROR_TOAST,
    mutationFn: () => api.post<ConventionsState>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (state) => qc.setQueryData(["conventions", repoId], state),
    onError: () => qc.invalidateQueries({ queryKey: ["conventions", repoId] }),
  });
}

export interface ConventionPatch {
  status?: ConventionStatus;
  rule?: string;
}

/** Accept / reject / back to review, or edit the rule text. Errors use the global toast. */
export function useUpdateConvention(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ConventionPatch }) =>
      api.patch<ConventionCandidate>(`/repos/${repoId}/conventions/${id}`, patch),
    onSuccess: (updated) => {
      qc.setQueryData<ConventionsState>(["conventions", repoId], (old) =>
        old ? { ...old, candidates: old.candidates.map((c) => (c.id === updated.id ? updated : c)) } : old,
      );
      qc.invalidateQueries({ queryKey: ["conventions", repoId] });
    },
  });
}

/** Result of a bulk status change: how many of the PATCHes failed. */
export interface BulkStatusResult {
  total: number;
  failed: number;
}

/**
 * Select all / Deselect all: one PATCH per candidate (a scan keeps at most a
 * few dozen), in parallel, then one refetch. Resolves with the failure count —
 * the page says how many did not change, so no global toast per request.
 */
export function useSetConventionStatuses(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: LOCAL_ERROR_TOAST,
    mutationFn: async ({ ids, status }: { ids: readonly string[]; status: ConventionStatus }): Promise<BulkStatusResult> => {
      const results = await Promise.allSettled(
        ids.map((id) => api.patch<ConventionCandidate>(`/repos/${repoId}/conventions/${id}`, { status })),
      );
      return { total: ids.length, failed: results.filter((r) => r.status === "rejected").length };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["conventions", repoId] }),
  });
}

export interface ConventionSkillInput {
  name: string;
  description: string;
  body: string;
  convention_ids: string[];
  /** Omitted → the server creates it enabled. */
  enabled?: boolean;
}

/** The modal shows 409 / 422 inline, so no global toast. Saved as convention / extracted. */
export function useCreateConventionSkill(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: LOCAL_ERROR_TOAST,
    mutationFn: (input: ConventionSkillInput) => api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["conventions", repoId] });
    },
  });
}
