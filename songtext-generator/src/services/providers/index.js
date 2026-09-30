import { callAnthropic } from './anthropic.js';
import { callGemini } from './gemini.js';

export { AbortedError, ProviderError } from './http.js';

/**
 * Provider-Registry. Ein neuer Anbieter braucht genau einen Eintrag hier plus
 * ein Adapter-Modul mit der Signatur (request, apiKey, options) => Promise<string>.
 * Optionen: { signal, onDelta, onRetry } - onDelta schaltet auf Streaming.
 */
const ADAPTERS = {
  claude: { call: callAnthropic, keyField: 'anthropic' },
  gemini: { call: callGemini, keyField: 'google' }
};

export async function callProvider(request, keys, options = {}) {
  const adapter = ADAPTERS[request.provider];
  if (!adapter) throw new Error(`Unbekannter Provider: ${request.provider}`);
  const apiKey = keys[adapter.keyField]?.trim();
  if (!apiKey) throw new Error(`Kein API-Key für ${adapter.keyField} hinterlegt`);
  return adapter.call(request, apiKey, options);
}

export function keyFieldFor(providerId) {
  return ADAPTERS[providerId]?.keyField ?? null;
}
