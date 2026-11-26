import type { AgentSkillLink, Skill } from "@devdigest/shared";

/** One entry of the ordered set sent to PUT /agents/:id/skills. */
export interface LinkInput {
  skill_id: string;
  enabled: boolean;
}

/** A linked skill as the tab shows it, in prompt order. */
export interface LinkedRow {
  skill: Skill;
  enabled: boolean;
}

/** Move the item at `from` to position `to` (pure; out-of-range → unchanged copy). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** Join the links (ids + order) with the workspace skills; unknown ids are skipped. */
export function linkedRows(links: readonly AgentSkillLink[], skills: readonly Skill[]): LinkedRow[] {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  return [...links]
    .sort((a, b) => a.order - b.order)
    .flatMap((l) => {
      const skill = byId.get(l.skill_id);
      return skill ? [{ skill, enabled: l.enabled }] : [];
    });
}

export function toLinkInputs(rows: readonly LinkedRow[]): LinkInput[] {
  return rows.map((r) => ({ skill_id: r.skill.id, enabled: r.enabled }));
}
