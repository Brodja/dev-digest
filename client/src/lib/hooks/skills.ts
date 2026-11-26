/* hooks/skills.ts — React Query hooks for the Skills page (server/specs/002-skills.md).
   Linking skills to an agent lives in hooks/agents.ts (useAgentSkills / useSetAgentSkills). */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { LOCAL_ERROR_TOAST } from "../mutation-meta";
import type { Skill, SkillDetail, SkillImportPreview, SkillType } from "@devdigest/shared";

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

/** One skill + the agents that link it (side preview). */
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

/** Callers show their own error (card toast, editor inline), not the global toast. */
export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    meta: LOCAL_ERROR_TOAST,
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill", data.id] });
    },
  });
}

/** The preview drawer shows the error toast (with the skill's name). */
export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    meta: LOCAL_ERROR_TOAST,
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
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
