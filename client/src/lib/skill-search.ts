/** Skill search shared by the Skills Lab list and the agent Skills tab
    (client/specs/004-skills-lab-design.md). Pure. */

interface Searchable {
  name: string;
  description: string;
  type: string;
}

/** Case-insensitive match on name, description or type; a blank query keeps all. */
export function filterSkills<T extends Searchable>(skills: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter(
    (sk) => sk.name.toLowerCase().includes(q) || sk.description.toLowerCase().includes(q) || sk.type.includes(q),
  );
}
