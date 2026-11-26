/**
 * tokenizer adapter — implements the shared `Tokenizer` port.
 *
 * Consumers (through `container.tokenizer`):
 *  - repo-intel: the repo-map renderer (pipeline/repo-map.ts) binary-searches
 *    the largest set of symbols that fits a token budget (≤ ~13 calls);
 *  - reviews: the run executor counts the tokens of the skills block for the
 *    run trace (server/specs/002-skills.md).
 *
 * Default impl: js-tiktoken `cl100k_base` (pure-JS, no natives). The encoder is
 * lazy-initialised (loading the BPE ranks is the heavy part) and any failure
 * falls back to the `ceil(chars / 4)` heuristic — callers must never see a throw.
 * Swappable in tests via a mock counter (ContainerOverrides.tokenizer).
 */
import { getEncoding, type Tiktoken } from 'js-tiktoken';
import type { Tokenizer } from '@devdigest/shared';

export type { Tokenizer };

/** Heuristic fallback used before/instead of a real encoder. */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class TiktokenTokenizer implements Tokenizer {
  private enc?: Tiktoken;
  private broken = false;

  count(text: string): number {
    if (this.broken) return approxTokens(text);
    try {
      this.enc ??= getEncoding('cl100k_base');
      return this.enc.encode(text).length;
    } catch {
      // BPE load failed once — don't retry per call; stick to the heuristic.
      this.broken = true;
      return approxTokens(text);
    }
  }
}
