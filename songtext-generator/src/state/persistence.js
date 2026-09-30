import { STATE_VERSION, createInitialState } from './songReducer.js';
import { PROVIDER_BY_ID, defaultModelFor } from '../domain/providers.js';

const SONG_KEY = 'mlsg.song.v1';
const KEYS_KEY = 'mlsg.apikeys.v1';

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Modell-IDs altern: Anbieter benennen Modelle um oder stellen sie ab. Ein
 * gespeicherter Block mit einer ID, die es nicht mehr gibt, liefe beim
 * nächsten Lauf in einen 404 - deshalb wird er beim Laden auf das aktuelle
 * Standardmodell seines Anbieters zurückgesetzt.
 */
function healModel(block) {
  const provider = PROVIDER_BY_ID[block.provider];
  if (!provider) return { ...block, provider: 'claude', model: defaultModelFor('claude') };
  if (provider.models.some((m) => m.id === block.model)) return block;
  return { ...block, model: defaultModelFor(block.provider) };
}

export function loadSong() {
  const parsed = safeParse(localStorage.getItem(SONG_KEY));
  if (!parsed || parsed.version !== STATE_VERSION) return createInitialState();
  return {
    ...parsed,
    blocks: (parsed.blocks ?? []).map(healModel),
    // UI-Zustand wird nie persistiert übernommen - Panels starten geschlossen.
    ui: createInitialState().ui
  };
}

export function saveSong(state) {
  try {
    localStorage.setItem(SONG_KEY, JSON.stringify(state));
  } catch {
    /* Speicher voll oder gesperrt - die App läuft ohne Persistenz weiter. */
  }
}

/**
 * API-Keys liegen bewusst nur im localStorage dieses Browsers und verlassen
 * ihn ausschließlich als Authorization-Header an den jeweiligen Anbieter.
 */
export function loadKeys() {
  return { anthropic: '', google: '', ...(safeParse(localStorage.getItem(KEYS_KEY)) ?? {}) };
}

export function saveKeys(keys) {
  try {
    localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
  } catch {
    /* ignorieren */
  }
}

export function clearAll() {
  localStorage.removeItem(SONG_KEY);
  localStorage.removeItem(KEYS_KEY);
}
