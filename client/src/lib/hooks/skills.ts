/* hooks/skills.ts — React Query hooks for the Skills pages (server/specs/002-skills.md,
   client/specs/004-skills-lab-design.md). Linking skills to an agent lives in hooks/agents.ts
   (useAgentSkills / useSetAgentSkills). */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { LOCAL_ERROR_TOAST } from "../mutation-meta";
import type {
  Skill,
  SkillDetail,
  SkillImportPreview,
  SkillListItem,
  SkillStats,
  SkillType,
  SkillVersion,
} from "@devdigest/shared";

/** Every skill of the workspace with its usage (agents, pull rate, accept rate). */
export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<SkillListItem[]>("/skills"),
  });
}

/** One skill + the agents that link it (the skill page). */
export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<SkillDetail>(`/skills/${id}`),
    enabled: !!id,
  });
}

export interface SkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled?: boolean;
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SkillInput) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: Partial<SkillInput>;
}

/** Every cached view of one skill after it changed (a body change adds a version). */
function invalidateSkill(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["skills"] });
  qc.invalidateQueries({ queryKey: ["skill", id] });
  qc.invalidateQueries({ queryKey: ["skill-versions", id] });
  qc.invalidateQueries({ queryKey: ["skill-stats", id] });
}

/** Callers show their own error (card toast, editor inline), not the global toast. */
export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    meta: LOCAL_ERROR_TOAST,
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => invalidateSkill(qc, data.id),
  });
}

/** Body history, newest first (Versions tab). */
export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

/** Bring an old body back as the next version. The caller toasts the outcome. */
export function useRestoreSkillVersion() {
  const qc = useQueryClient();
  return useMutation({
    meta: LOCAL_ERROR_TOAST,
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post<Skill>(`/skills/${id}/restore`, { version }),
    onSuccess: (data) => invalidateSkill(qc, data.id),
  });
}

/** Agents that link the skill + its version count (Stats tab). */
export function useSkillStats(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-stats", id],
    queryFn: () => api.get<SkillStats>(`/skills/${id}/stats`),
    enabled: !!id,
  });
}

/** The caller shows the error toast (with the skill's name). */
export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    meta: LOCAL_ERROR_TOAST,
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
      qc.removeQueries({ queryKey: ["skill-versions", id] });
      qc.removeQueries({ queryKey: ["skill-stats", id] });
      // Its links went by cascade.
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
    },
  });
}

export interface SkillUploadInput {
  filename: string;
  /** The file's bytes, base64 (no data: prefix). */
  content_base64: string;
}

/** Upload → draft + what is ignored. Stores nothing (no cache either). */
export function useImportSkillPreview() {
  return useMutation({
    mutationFn: (input: SkillUploadInput) => api.post<SkillImportPreview>("/skills/import/preview", input),
  });
}

/** Save the confirmed draft: an untrusted, disabled imported skill. */
export function useImportSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SkillInput, "enabled">) => api.post<Skill>("/skills/import", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}
