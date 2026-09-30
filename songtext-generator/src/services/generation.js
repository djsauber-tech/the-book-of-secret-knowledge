import { buildRequest } from './promptBuilder.js';
import { callProvider } from './providers/index.js';

/** Räumt Modell-Ausgaben auf: Codefences, Nummerierungen, Anführungszeichen. */
function cleanLine(raw) {
  return raw
    .replace(/^\s*```.*$/, '')
    .replace(/^\s*[-*•]\s+/, '')
    .replace(/^\s*\d+\s*[.):]\s*/, '')
    .replace(/^["„“](.*)["“”]$/, '$1')
    .trim();
}

export function parseFullResponse(text) {
  return text
    .split('\n')
    .map(cleanLine)
    .filter((line) => line !== '' && !/^\[.*\]$/.test(line));
}

/**
 * Parst die Antwort des Micro-Editors: "<nr>: <text>" pro Zeile.
 * Es werden nur die erwarteten Zeilennummern übernommen - alles andere
 * (Vorreden, gelockte Nummern, Halluzinationen) fliegt raus.
 */
export function parseLinePatch(text, expectedLineNumbers) {
  const allowed = new Set(expectedLineNumbers);
  const patch = {};
  for (const row of text.split('\n')) {
    const match = row.match(/^\s*(\d+)\s*[:.)]\s*(.+)$/);
    if (!match) continue;
    const number = Number(match[1]);
    if (!allowed.has(number)) continue;
    patch[number] = cleanLine(match[2]);
  }
  return patch;
}

/**
 * Einziger Einstiegspunkt der UI in die Generierung: baut den Request,
 * ruft den Provider, parst die Antwort und liefert eine Reducer-Action.
 */
export async function generateBlock({ state, block, mode, keys, signal }) {
  const request = buildRequest(state, block, mode);
  const raw = await callProvider(request, keys, { signal });
  if (!raw) throw new Error('Leere Antwort vom Modell');

  if (request.mode === 'lines') {
    const patch = parseLinePatch(raw, request.expectedLineNumbers);
    if (Object.keys(patch).length === 0) {
      throw new Error('Antwort enthielt keine verwertbaren Zeilennummern');
    }
    return { type: 'GENERATION_PATCHED', blockId: block.id, patch, request, raw };
  }

  const lines = parseFullResponse(raw);
  if (lines.length === 0) throw new Error('Antwort enthielt keine Songzeilen');
  return { type: 'GENERATION_REPLACED', blockId: block.id, lines, request, raw };
}
