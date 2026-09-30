/**
 * Gemeinsame Transport-Schicht beider Adapter: Retry bei Rate-Limits und
 * Überlast, Abbruch über AbortSignal, und ein SSE-Reader fürs Streaming.
 * Anbieterspezifisch bleibt nur noch Request-Body und Antwort-Form.
 */

/** Status, bei denen ein erneuter Versuch überhaupt Sinn ergibt. */
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;

export class ProviderError extends Error {
  constructor(message, { status = null, retryable = false, vendor = '' } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.retryable = retryable;
    this.vendor = vendor;
  }
}

export class AbortedError extends Error {
  constructor() {
    super('Abgebrochen');
    this.name = 'AbortedError';
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new AbortedError());
      },
      { once: true }
    );
  });
}

/**
 * Wartezeit vor dem nächsten Versuch. `Retry-After` des Anbieters gewinnt,
 * sonst exponentiell mit Jitter, damit parallele Bloecke nicht im Gleichtakt
 * wieder anklopfen.
 */
function backoffMs(attempt, response) {
  const header = response?.headers?.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30000);
  }
  const exponential = BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(exponential + Math.random() * 400, 30000);
}

/**
 * fetch mit Retry. Wirft ProviderError mit lesbarer Meldung, AbortedError bei
 * Abbruch durch den Nutzer. `onRetry` meldet Wartezeiten an die UI.
 */
export async function fetchWithRetry(url, init, { signal, vendor, onRetry } = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw new AbortedError();

    let response;
    try {
      response = await fetch(url, { ...init, signal });
    } catch (error) {
      if (signal?.aborted || error.name === 'AbortError') throw new AbortedError();
      // Netzwerkfehler: einmal mehr versuchen, das ist oft nur ein Aussetzer.
      lastError = new ProviderError(`${vendor}: Netzwerkfehler (${error.message})`, {
        retryable: true,
        vendor
      });
      if (attempt === MAX_ATTEMPTS) throw lastError;
      onRetry?.({ attempt, delayMs: backoffMs(attempt, null), reason: 'Netzwerkfehler' });
      await wait(backoffMs(attempt, null), signal);
      continue;
    }

    if (response.ok) return response;

    const detail = await response.text().catch(() => '');
    const message = `${vendor} ${response.status}: ${detail.slice(0, 400) || response.statusText}`;

    if (!RETRYABLE.has(response.status) || attempt === MAX_ATTEMPTS) {
      throw new ProviderError(message, {
        status: response.status,
        retryable: RETRYABLE.has(response.status),
        vendor
      });
    }

    const delayMs = backoffMs(attempt, response);
    onRetry?.({
      attempt,
      delayMs,
      reason: response.status === 429 ? 'Rate-Limit' : `HTTP ${response.status}`
    });
    lastError = new ProviderError(message, { status: response.status, retryable: true, vendor });
    await wait(delayMs, signal);
  }

  throw lastError ?? new ProviderError(`${vendor}: unbekannter Fehler`, { vendor });
}

/**
 * Liest einen SSE-Body und ruft `onEvent` je Ereignis mit dem geparsten
 * data-Objekt. Beide Anbieter sprechen SSE, nur die Nutzlast unterscheidet sich.
 */
export async function readSSE(response, onEvent, signal) {
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError('Streaming nicht verfügbar (kein Body)');
  const decoder = new TextDecoder();
  let buffer = '';

  const flush = (chunk) => {
    const dataLines = chunk
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) return;
    const payload = dataLines.join('');
    if (payload === '[DONE]') return;
    try {
      onEvent(JSON.parse(payload));
    } catch {
      /* unvollständiges oder fremdes Ereignis - überspringen */
    }
  };

  try {
    while (true) {
      if (signal?.aborted) throw new AbortedError();
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Ereignisse sind durch eine Leerzeile getrennt; der letzte Teil ist
      // in aller Regel unvollständig und wandert zurück in den Puffer.
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? '';
      chunks.forEach(flush);
    }
    if (buffer.trim()) flush(buffer);
  } finally {
    reader.releaseLock?.();
  }
}
