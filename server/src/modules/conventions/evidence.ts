import { SNIPPET_COMPACT_MIN_NON_WS, SNIPPET_MAX_LINES, SNIPPET_MIN_NON_WS } from './constants.js';

/**
 * Evidence matching (server/specs/003-conventions.md → Evidence check). Pure:
 * no disk, no model. The model only names a file and quotes text; this code
 * decides whether the quote is really in that file and which lines it spans.
 */

/** CRLF / CR → LF, leading BOM removed, Unicode NFC. Applied once to every file
 *  before it is sent to the model, and to every snippet before it is matched. */
export function prepareSource(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').normalize('NFC');
}

const WS = /\s/u;

export function nonWhitespaceLength(s: string): number {
  let n = 0;
  for (const ch of s) if (!WS.test(ch)) n++;
  return n;
}

/** Remove a surrounding ``` fence (optionally with a language tag). */
export function cleanSnippet(raw: string): string {
  const text = prepareSource(raw).trim();
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(text);
  return fenced?.[1] !== undefined ? fenced[1].trim() : text;
}

interface Mapped {
  text: string;
  /** For each UTF-16 unit of `text`, the 1-based source line it came from. */
  lines: number[];
}

/**
 * Whitespace-normalised view of `src`: `collapse` turns every whitespace run
 * into one space (trimmed at both ends), `strip` removes all whitespace.
 */
function mapWhitespace(src: string, mode: 'collapse' | 'strip'): Mapped {
  let text = '';
  const lines: number[] = [];
  let line = 1;
  let pendingSpace = false;
  let spaceLine = 1;
  for (const ch of src) {
    if (WS.test(ch)) {
      if (mode === 'collapse' && text.length > 0 && !pendingSpace) {
        pendingSpace = true;
        spaceLine = line;
      }
      if (ch === '\n') line++;
      continue;
    }
    if (pendingSpace) {
      text += ' ';
      lines.push(spaceLine);
      pendingSpace = false;
    }
    text += ch;
    for (let i = 0; i < ch.length; i++) lines.push(line);
  }
  return { text, lines };
}

function findRange(
  fileText: string,
  snippet: string,
  mode: 'collapse' | 'strip',
): { startLine: number; endLine: number } | null {
  const needle = mapWhitespace(snippet, mode).text;
  if (!needle) return null;
  const hay = mapWhitespace(fileText, mode);
  const at = hay.text.indexOf(needle);
  if (at < 0) return null;
  const startLine = hay.lines[at];
  const endLine = hay.lines[at + needle.length - 1];
  return startLine !== undefined && endLine !== undefined ? { startLine, endLine } : null;
}

export interface EvidenceMatch {
  startLine: number;
  endLine: number;
  /** The file's real lines startLine..endLine (trailing whitespace trimmed). */
  snippet: string;
}

/**
 * Find `rawSnippet` in `fileText` (already `prepareSource`d — the exact text the
 * model saw). First occurrence wins. Returns null when the snippet is too short
 * to be evidence, is not in the file, or spans more than SNIPPET_MAX_LINES.
 */
export function locateSnippet(fileText: string, rawSnippet: string): EvidenceMatch | null {
  const cleaned = cleanSnippet(rawSnippet);
  const variants = [cleaned];
  // Some models double-escape newlines inside JSON strings: try once unescaped.
  if (cleaned.includes('\\n')) variants.push(cleaned.replace(/\\n/g, '\n').replace(/\\t/g, '\t'));

  for (const snippet of variants) {
    const nonWs = nonWhitespaceLength(snippet);
    if (nonWs < SNIPPET_MIN_NON_WS) continue;
    const range =
      findRange(fileText, snippet, 'collapse') ??
      (nonWs >= SNIPPET_COMPACT_MIN_NON_WS ? findRange(fileText, snippet, 'strip') : null);
    if (!range) continue;
    if (range.endLine - range.startLine + 1 > SNIPPET_MAX_LINES) return null;
    const lines = fileText
      .split('\n')
      .slice(range.startLine - 1, range.endLine)
      .map((l) => l.trimEnd());
    return { ...range, snippet: lines.join('\n') };
  }
  return null;
}
