import { SkillsView } from "./_components/SkillsView";

/* Route: /skills (Skills Lab). Thin route entry — the skill list on the left and
   a "pick a skill" placeholder; a skill opens /skills/:id (client/specs/004). */
export default function SkillsPage() {
  return <SkillsView />;
}
