import { TrustedSkillSource, type SkillSource } from '@devdigest/shared';

/**
 * Whether a skill from this source may reach the prompt as plain (trusted)
 * text. Everything else is wrapped as <untrusted source="skill:…">.
 *
 * Lives in platform/ (cross-cutting) so the skills module and the review run
 * executor share one rule without importing each other.
 */
export function isTrustedSkillSource(source: SkillSource): boolean {
  return (TrustedSkillSource.options as readonly string[]).includes(source);
}
