import { PROVIDER_BY_ID } from '../domain/providers.js';
import { callProvider } from './providers/index.js';

/**
 * Übersetzt Anbieter-Fehler in Klartext plus einen konkreten nächsten Schritt.
 *
 * Beide APIs melden dieselben vier Klassiker sehr unterschiedlich: falscher
 * Key, vom Browser blockiert, unbekannter Modellname, Kontingent erschöpft.
 * Ohne diese Übersetzung steht am Block eine nackte Statuszeile, mit der man
 * nichts anfangen kann.
 */

/** Fehlercode aus dem Antwortkörper ziehen - je Anbieter woanders. */
function codeOf(body) {
  if (!body || typeof body !== 'object') return '';
  return String(body.error?.type ?? body.error?.status ?? body.error?.code ?? '').toLowerCase();
}

function messageOf(body) {
  if (typeof body === 'string') return body;
  if (!body || typeof body !== 'object') return '';
  return String(body.error?.message ?? '');
}

export function describeFailure(error) {
  const vendor = error?.vendor || 'Der Anbieter';
  const status = error?.status ?? null;
  const code = codeOf(error?.body);
  const detail = messageOf(error?.body);

  // 1) Gar nicht rausgegangen: offline, DNS, oder vom Browser blockiert.
  if (error?.network) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        headline: 'Keine Internetverbindung',
        remedy: 'Der Browser meldet sich als offline. Verbindung prüfen und erneut versuchen.'
      };
    }
    return {
      headline: `Anfrage an ${vendor} kam nicht durch`,
      remedy:
        'Meist blockiert der Browser den Aufruf (CORS) oder ein Adblocker/Proxy hängt dazwischen. ' +
        'Die Konsole des Browsers (F12 → Netzwerk) zeigt, welcher der beiden Fälle es ist. ' +
        'Bei einer Firmen-Firewall hilft nur ein anderer Netzzugang.'
    };
  }

  // 2) Key falsch, abgelaufen oder ohne Berechtigung.
  if (status === 401 || code.includes('authentication') || code.includes('api_key_invalid') ||
      (status === 400 && /api[ _]key/i.test(detail))) {
    return {
      headline: `${vendor} lehnt den API-Key ab`,
      remedy:
        'Key im Settings-Panel prüfen: vollständig kopiert, keine Leerzeichen am Rand, ' +
        'und beim richtigen Anbieter eingetragen. Anthropic-Keys beginnen mit "sk-ant-", Google-Keys mit "AIza".'
    };
  }

  if (status === 403 || code.includes('permission')) {
    return {
      headline: `${vendor}: Key hat keine Berechtigung`,
      remedy:
        'Der Key ist gültig, darf dieses Modell aber nicht nutzen. ' +
        'In der Konsole des Anbieters prüfen, ob die API aktiviert und das Modell freigeschaltet ist.'
    };
  }

  // 3) Modellname unbekannt - passiert nach jeder Modell-Umbenennung.
  if (status === 404 || code.includes('not_found')) {
    return {
      headline: `${vendor} kennt dieses Modell nicht`,
      remedy:
        'Der Modellname stimmt nicht (mehr). Im Block ein anderes Modell wählen, ' +
        'oder die Liste in src/domain/providers.js an die aktuellen Modell-IDs des Anbieters anpassen.'
    };
  }

  // 4) Kontingent: Guthaben leer ist etwas anderes als zu schnell geklopft.
  if (/credit balance|quota|billing|insufficient/i.test(detail)) {
    return {
      headline: `${vendor}: Kontingent oder Guthaben erschöpft`,
      remedy: 'Im Abrechnungsbereich des Anbieters Guthaben aufladen bzw. das Kontingent erhöhen.'
    };
  }

  if (status === 429 || code.includes('rate_limit') || code.includes('resource_exhausted')) {
    return {
      headline: `${vendor}: zu viele Anfragen`,
      remedy:
        'Das Rate-Limit greift. Die App hat bereits mehrfach mit Wartezeit wiederholt — ' +
        'kurz warten und erneut versuchen, oder weniger Blöcke gleichzeitig laufen lassen.'
    };
  }

  if (status === 400) {
    return {
      headline: `${vendor} weist die Anfrage zurück`,
      remedy: detail
        ? `Begründung des Anbieters: ${detail}`
        : 'Die Anfrage war fehlerhaft. Prompt-Vorschau öffnen und auf Auffälliges prüfen.'
    };
  }

  if (status && status >= 500) {
    return {
      headline: `${vendor} hat gerade eine Störung (HTTP ${status})`,
      remedy: 'Serverseitig, nicht deine Schuld. Die App hat mehrfach wiederholt — später erneut versuchen.'
    };
  }

  return {
    headline: error?.message ?? 'Unbekannter Fehler',
    remedy: detail || 'Kein weiterer Hinweis vom Anbieter.'
  };
}

/** Fehler als mehrzeiliger Klartext, wie ihn die Fehlerleiste am Block zeigt. */
export function formatFailure(error) {
  const { headline, remedy } = describeFailure(error);
  const raw = error?.message && error.message !== headline ? `\n\n${error.message}` : '';
  return `${headline}\n→ ${remedy}${raw}`;
}

/**
 * Minimaler echter Aufruf, nur um zu sehen, ob Key, Netz und Modellname
 * zusammenpassen. Genau ein Versuch - bei einem Test will niemand 15 Sekunden
 * auf ausgereizte Retries warten.
 */
export async function testConnection(providerId, keys, { signal } = {}) {
  const provider = PROVIDER_BY_ID[providerId];
  const model = provider.models[0].id;
  const startedAt = performance.now();

  try {
    await callProvider(
      {
        provider: providerId,
        model,
        system: 'Antworte mit einem einzigen Wort.',
        user: 'ping',
        maxTokens: 512,
        temperature: 0
      },
      keys,
      { signal, attempts: 1 }
    );
    return {
      ok: true,
      model,
      latencyMs: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    return { ok: false, model, ...describeFailure(error) };
  }
}
