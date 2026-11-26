import type { AgentSkillLink, Skill } from "@devdigest/shared";

/** One entry of the ordered set sent to PUT /agents/:id/skills. */
export interface LinkInput {
  skill_id: string;
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

/**
 * The tab's one list (screen_agents.jsx, client/specs/004): the linked skills in
 * prompt order, then every other workspace skill by name. A link switched off
 * (enabled = false, from the API or the old tab) never reaches the prompt, so it
 * shows unchecked among the rest and the next save drops it.
 */
export function splitRows(
  links: readonly AgentSkillLink[],
  skills: readonly Skill[],
): { linked: Skill[]; rest: Skill[] } {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  const linked = [...links]
    .filter((l) => l.enabled)
    .sort((a, b) => a.order - b.order)
    .flatMap((l) => {
      const skill = byId.get(l.skill_id);
      return skill ? [skill] : [];
    });
  const linkedIds = new Set(linked.map((sk) => sk.id));
  const rest = skills
    .filter((sk) => !linkedIds.has(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { linked, rest };
}

/** Check → append at the end of the prompt order; uncheck → unlink. */
export function toggleLink(linkedIds: readonly string[], skillId: string): string[] {
  return linkedIds.includes(skillId) ? linkedIds.filter((id) => id !== skillId) : [...linkedIds, skillId];
}

/** The ordered set PUT sends: every linked skill, enabled. */
export function toLinkInputs(linkedIds: readonly string[]): LinkInput[] {
  return linkedIds.map((skill_id) => ({ skill_id, enabled: true }));
}
