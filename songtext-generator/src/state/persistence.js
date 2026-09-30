import { STATE_VERSION, createInitialState } from './songReducer.js';

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

export function loadSong() {
  const parsed = safeParse(localStorage.getItem(SONG_KEY));
  if (!parsed || parsed.version !== STATE_VERSION) return createInitialState();
  // UI-Zustand wird nie persistiert übernommen - Panels starten geschlossen.
  return { ...parsed, ui: createInitialState().ui };
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
