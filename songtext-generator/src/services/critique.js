import { buildCritiqueRequest } from './promptBuilder.js';
import { callProvider } from './providers/index.js';
import { PROVIDERS, PROVIDER_BY_ID, defaultModelFor } from '../domain/providers.js';

/**
 * Wer prüft: standardmäßig das jeweils andere Modell. Der Sinn der Kreuz-Kritik
 * ist genau dieser Perspektivwechsel - ein Modell erkennt die eigenen Reflexe
 * schlechter als die eines fremden.
 */
export function reviewerFor(block, keys) {
  const others = PROVIDERS.filter((p) => p.id !== block.provider);
  const withKey = others.find((p) => keys[p.keyField]?.trim());
  const fallback = PROVIDER_BY_ID[block.provider];
  const chosen = withKey ?? (keys[fallback.keyField]?.trim() ? fallback : null);
  if (!chosen) return null;
  return {
    provider: chosen.id,
    model: defaultModelFor(chosen.id),
    isCross: chosen.id !== block.provider
  };
}

/**
 * Modelle verpacken JSON gern in Prosa oder Codefences. Wir schneiden auf das
 * äußerste Array zu, bevor wir parsen.
 */
export function parseCritique(raw) {
  const fenced = raw.replace(/```(?:json)?/gi, '');
  const start = fenced.indexOf('[');
  const end = fenced.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Kritik-Antwort enthielt kein JSON-Array');
  }

  let parsed;
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1));
  } catch (error) {
    throw new Error(`Kritik-Antwort war kein gültiges JSON (${error.message})`);
  }
  if (!Array.isArray(parsed)) throw new Error('Kritik-Antwort war kein Array');

  return parsed
    .filter((item) => item && typeof item === 'object' && typeof item.problem === 'string')
    .map((item, i) => ({
      id: `finding_${i}`,
      line: Number.isInteger(item.line) && item.line > 0 ? item.line : null,
      severity: item.severity === 'weich' ? 'weich' : 'hart',
      strategy: typeof item.strategy === 'string' && item.strategy.trim() ? item.strategy.trim() : null,
      problem: item.problem.trim(),
      suggestion:
        typeof item.suggestion === 'string' && item.suggestion.trim()
          ? item.suggestion.trim()
          : null
    }))
    .slice(0, 8);
}

export async function critiqueBlock({ state, block, reviewer, keys, signal, onRetry }) {
  const request = buildCritiqueRequest(state, block, reviewer);
  const raw = await callProvider(request, keys, { signal, onRetry });
  return { findings: parseCritique(raw), reviewer, raw };
}
