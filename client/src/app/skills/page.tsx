import { SkillsView } from "./_components/SkillsView";

/* Route: /skills (Skills page). Thin route entry — the grid, preview drawer and
   editor modal live under _components/ (server/specs/002-skills.md). */
export default function SkillsPage() {
  return <SkillsView />;
}
