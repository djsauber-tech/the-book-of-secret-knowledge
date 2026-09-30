import { ProviderError, fetchWithRetry, readSSE } from './http.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const VENDOR = 'Anthropic';

function body(request, stream) {
  return JSON.stringify({
    model: request.model,
    max_tokens: request.maxTokens ?? 1024,
    temperature: request.temperature ?? 1,
    system: request.system,
    messages: [{ role: 'user', content: request.user }],
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
export async function callAnthropic(request, apiKey, { signal, onDelta, onRetry } = {}) {
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
    { signal, vendor: VENDOR, onRetry }
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
