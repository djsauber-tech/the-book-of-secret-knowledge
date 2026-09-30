import { buildRequest } from './promptBuilder.js';
import { callProvider } from './providers/index.js';
import { PROVIDERS } from '../domain/providers.js';
import { defaultModelFor } from '../domain/providers.js';

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
export async function generateBlock({ state, block, mode, keys, signal, onDelta, onRetry }) {
  const request = buildRequest(state, block, mode);
  const raw = await callProvider(request, keys, { signal, onDelta, onRetry });
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

/**
 * Varianten-Duell: derselbe Block, gleichzeitig von jedem Anbieter, für den ein
 * Key hinterlegt ist. Die Ergebnisse landen NICHT im Block, sondern daneben -
 * übernommen wird erst per Klick, ganz oder zeilenweise.
 *
 * Promise.allSettled statt all: fällt ein Anbieter aus, bleibt die andere
 * Variante trotzdem brauchbar.
 */
export async function generateVariants({ state, block, keys, signal, onRetry }) {
  const contenders = PROVIDERS.filter((p) => keys[p.keyField]?.trim()).map((p) => ({
    provider: p.id,
    model: p.id === block.provider ? block.model : defaultModelFor(p.id),
    label: p.label
  }));

  if (contenders.length === 0) throw new Error('Kein API-Key hinterlegt');

  const results = await Promise.allSettled(
    contenders.map(async (contender) => {
      const request = buildRequest(state, { ...block, ...contender }, 'full');
      const raw = await callProvider(request, keys, { signal, onRetry });
      const lines = parseFullResponse(raw);
      if (lines.length === 0) throw new Error('Antwort enthielt keine Songzeilen');
      return { ...contender, lines, raw };
    })
  );

  const variants = [];
  const failures = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') variants.push(result.value);
    else failures.push(`${contenders[i].label}: ${result.reason?.message ?? result.reason}`);
  });

  if (variants.length === 0) throw new Error(failures.join(' | '));
  return { variants, failures };
}
