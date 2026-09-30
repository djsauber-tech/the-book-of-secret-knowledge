import { ProviderError, fetchWithRetry, readSSE } from './http.js';
import { modelTraits } from '../../domain/providers.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const VENDOR = 'Anthropic';

/**
 * Die aktuellen Claude-Modelle (Opus 5.5/5, Sonnet 5.5) haben zwei Eigenheiten,
 * die hier zwingend berücksichtigt werden müssen:
 *
 * 1. Sie weisen `temperature` mit HTTP 400 ab - Sampling-Parameter gibt es
 *    dort nicht mehr. Gesteuert wird über `output_config.effort`.
 * 2. Sie denken standardmäßig mit ("adaptive thinking"). Diese Thinking-Tokens
 *    gehen von `max_tokens` ab. Mit einem knappen Budget verbraucht das Modell
 *    alles im Nachdenken und liefert am Ende keine einzige Songzeile - deshalb
 *    liegt das Budget großzügig, und der Effort bleiben niedrig: Songzeilen
 *    schreiben ist keine Denksportaufgabe.
 */
export function body(request, stream) {
  const traits = modelTraits('claude', request.model);
  return JSON.stringify({
    model: request.model,
    max_tokens: request.maxTokens ?? 8192,
    system: request.system,
    messages: [{ role: 'user', content: request.user }],
    ...(traits.sampling && request.temperature !== undefined
      ? { temperature: request.temperature }
      : {}),
    ...(traits.effort ? { output_config: { effort: request.effort ?? 'low' } } : {}),
    ...(stream ? { stream: true } : {})
  });
}

/**
 * Anthropic Messages API. Der Header anthropic-dangerous-direct-browser-access
 * ist nötig, weil der Aufruf direkt aus dem Browser kommt - das ist für eine
 * rein lokale Anwendung mit dem eigenen Key gedacht, nicht für ein Deployment.
 *
 * Mit `onDelta` wird gestreamt, sonst in einem Rutsch geladen.
 */
export async function callAnthropic(request, apiKey, { signal, onDelta, onRetry, attempts } = {}) {
  const stream = typeof onDelta === 'function';
  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': API_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true'
  };

  const response = await fetchWithRetry(
    ENDPOINT,
    { method: 'POST', headers, body: body(request, stream) },
    { signal, vendor: VENDOR, onRetry, attempts }
  );

  if (!stream) {
    const data = await response.json();
    return (data.content ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim();
  }

  let text = '';
  await readSSE(
    response,
    (event) => {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        text += event.delta.text;
        onDelta(text);
      }
      if (event.type === 'error') {
        throw new ProviderError(`${VENDOR}: ${event.error?.message ?? 'Stream-Fehler'}`, {
          vendor: VENDOR
        });
      }
    },
    signal
  );
  return text.trim();
}
