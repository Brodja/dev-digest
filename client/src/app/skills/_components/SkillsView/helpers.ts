import type { Skill } from "@devdigest/shared";

/** Case-insensitive match on name, description or type. */
export function filterSkills(skills: Skill[], query: string): Skill[] {
  const q = query.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter(
    (sk) =>
      sk.name.toLowerCase().includes(q) ||
      sk.description.toLowerCase().includes(q) ||
      sk.type.includes(q),
  );
}
