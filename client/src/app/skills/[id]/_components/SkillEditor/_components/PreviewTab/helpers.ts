/**
 * The skill's block as the reviewer's prompt carries it — the same layout as
 * reviewer-core `renderSkillBlock` (`### <name>`, the description, a blank
 * line, the body), minus the <untrusted> wrapper, which the tab explains apart.
 */
export function promptBlock(skill: { name: string; description: string; body: string }): string {
  const head = [`### ${skill.name}`];
  const description = skill.description.trim();
  if (description) head.push(description);
  return `${head.join("\n")}\n\n${skill.body.trim()}`;
}
