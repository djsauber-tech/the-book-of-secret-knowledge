import { AUTO_STRATEGIES, BLOCK_TYPE_BY_ID } from '../domain/blockTypes.js';
import { defaultModelFor } from '../domain/providers.js';

export const STATE_VERSION = 1;

let idCounter = 0;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function createLine(text = '') {
  return { id: nextId('line'), text, locked: false };
}

export function createBlock(partial = {}) {
  const type = partial.type ?? 'strophe';
  const typeDef = BLOCK_TYPE_BY_ID[type];
  return {
    id: nextId('block'),
    type,
    provider: partial.provider ?? 'claude',
    model: partial.model ?? defaultModelFor(partial.provider ?? 'claude'),
    prompt: '',
    targetLines: typeDef.defaultLines,
    autoStrategies: true,
    strategies: [...AUTO_STRATEGIES[type]],
    locked: false,
    lines: [],
    status: 'idle', // idle | running | error
    error: null,
    lastRunAt: null,
    ...partial
  };
}

export function createInitialState() {
  return {
    version: STATE_VERSION,
    title: 'UNBENANNTER SONG',
    global: {
      idea: '',
      vocabulary: '',
      storyPath: 'situational'
    },
    blocks: [
      createBlock({ type: 'strophe', provider: 'claude' }),
      createBlock({ type: 'refrain', provider: 'gemini' })
    ],
    ui: {
      settingsOpen: false,
      inspectBlockId: null
    }
  };
}

/**
 * Textarea-Eingaben sind die einzige Stelle, an der Zeilen neu entstehen, ohne
 * dass eine KI beteiligt war. Locks hängen an der Zeilenposition: wer eine
 * gelockte Zeile überschreibt, behält den Lock - wer Zeilen anfügt, bekommt
 * sie ungelockt.
 */
function linesFromText(text, previous) {
  if (text === '') return [];
  const rows = text.split('\n');
  return rows.map((row, i) => {
    const prev = previous[i];
    if (!prev) return createLine(row);
    return { ...prev, text: row };
  });
}

export function textFromLines(lines) {
  return lines.map((l) => l.text).join('\n');
}

function mapBlock(state, blockId, fn) {
  return {
    ...state,
    blocks: state.blocks.map((b) => (b.id === blockId ? fn(b) : b))
  };
}

function mapLine(state, blockId, lineId, fn) {
  return mapBlock(state, blockId, (b) => ({
    ...b,
    lines: b.lines.map((l) => (l.id === lineId ? fn(l) : l))
  }));
}

export function songReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return createInitialState();

    case 'HYDRATE':
      return action.state;

    case 'SET_TITLE':
      return { ...state, title: action.value };

    case 'SET_GLOBAL':
      return { ...state, global: { ...state.global, [action.field]: action.value } };

    case 'TOGGLE_SETTINGS':
      return { ...state, ui: { ...state.ui, settingsOpen: !state.ui.settingsOpen } };

    case 'INSPECT_BLOCK':
      return {
        ...state,
        ui: { ...state.ui, inspectBlockId: state.ui.inspectBlockId === action.blockId ? null : action.blockId }
      };

    /* ---------------- Struktur ---------------- */

    case 'ADD_BLOCK': {
      const block = createBlock({ type: action.blockType });
      const at = action.index ?? state.blocks.length;
      const blocks = [...state.blocks];
      blocks.splice(at, 0, block);
      return { ...state, blocks };
    }

    case 'REMOVE_BLOCK':
      return {
        ...state,
        blocks: state.blocks.filter((b) => b.id !== action.blockId),
        ui: {
          ...state.ui,
          inspectBlockId: state.ui.inspectBlockId === action.blockId ? null : state.ui.inspectBlockId
        }
      };

    case 'MOVE_BLOCK': {
      const from = state.blocks.findIndex((b) => b.id === action.blockId);
      const to = from + action.delta;
      if (from < 0 || to < 0 || to >= state.blocks.length) return state;
      const blocks = [...state.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...state, blocks };
    }

    case 'DUPLICATE_BLOCK': {
      const index = state.blocks.findIndex((b) => b.id === action.blockId);
      if (index < 0) return state;
      const source = state.blocks[index];
      const copy = {
        ...source,
        id: nextId('block'),
        locked: false,
        status: 'idle',
        error: null,
        lines: source.lines.map((l) => ({ ...l, id: nextId('line') }))
      };
      const blocks = [...state.blocks];
      blocks.splice(index + 1, 0, copy);
      return { ...state, blocks };
    }

    /* ---------------- Block-Konfiguration ---------------- */

    case 'SET_BLOCK_TYPE':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        type: action.value,
        targetLines: BLOCK_TYPE_BY_ID[action.value].defaultLines,
        strategies: b.autoStrategies ? [...AUTO_STRATEGIES[action.value]] : b.strategies
      }));

    case 'SET_BLOCK_PROVIDER':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        provider: action.value,
        model: defaultModelFor(action.value)
      }));

    case 'SET_BLOCK_FIELD':
      return mapBlock(state, action.blockId, (b) => ({ ...b, [action.field]: action.value }));

    case 'TOGGLE_BLOCK_LOCK':
      return mapBlock(state, action.blockId, (b) => ({ ...b, locked: !b.locked }));

    case 'TOGGLE_AUTO_STRATEGIES':
      return mapBlock(state, action.blockId, (b) => {
        const autoStrategies = !b.autoStrategies;
        return {
          ...b,
          autoStrategies,
          strategies: autoStrategies ? [...AUTO_STRATEGIES[b.type]] : b.strategies
        };
      });

    case 'TOGGLE_STRATEGY':
      return mapBlock(state, action.blockId, (b) => {
        const active = b.strategies.includes(action.strategyId);
        return {
          ...b,
          autoStrategies: false,
          strategies: active
            ? b.strategies.filter((s) => s !== action.strategyId)
            : [...b.strategies, action.strategyId]
        };
      });

    /* ---------------- Text & Zeilen ---------------- */

    case 'SET_BLOCK_TEXT':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        lines: linesFromText(action.value, b.lines)
      }));

    case 'SET_LINE_TEXT':
      return mapLine(state, action.blockId, action.lineId, (l) => ({ ...l, text: action.value }));

    case 'TOGGLE_LINE_LOCK':
      return mapLine(state, action.blockId, action.lineId, (l) => ({ ...l, locked: !l.locked }));

    case 'SET_ALL_LINE_LOCKS':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        lines: b.lines.map((l) => ({ ...l, locked: action.value }))
      }));

    case 'ADD_LINE':
      return mapBlock(state, action.blockId, (b) => ({ ...b, lines: [...b.lines, createLine('')] }));

    case 'REMOVE_LINE':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        lines: b.lines.filter((l) => l.id !== action.lineId)
      }));

    /* ---------------- Generierung ---------------- */

    case 'GENERATION_START':
      return mapBlock(state, action.blockId, (b) => ({ ...b, status: 'running', error: null }));

    case 'GENERATION_FAILED':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        status: 'error',
        error: action.error
      }));

    /**
     * Vollersatz: alle Zeilen neu. Gelockte Zeilen bleiben unangetastet, damit
     * ein versehentlicher Voll-Run keine fertige Zeile zerstört.
     */
    case 'GENERATION_REPLACED':
      return mapBlock(state, action.blockId, (b) => {
        const incoming = [...action.lines];
        const merged = [];
        const count = Math.max(b.lines.length, incoming.length);
        for (let i = 0; i < count; i += 1) {
          const existing = b.lines[i];
          if (existing?.locked) {
            merged.push(existing);
            continue;
          }
          const text = incoming.shift();
          if (text === undefined) continue;
          merged.push(existing ? { ...existing, text } : createLine(text));
        }
        return { ...b, lines: merged, status: 'idle', error: null, lastRunAt: Date.now() };
      });

    /**
     * Teilersatz: `patch` ist eine Map von Zeilennummer (1-basiert) auf Text.
     * Trifft nur freie Zeilen - gelockte Zeilen werden ignoriert.
     */
    case 'GENERATION_PATCHED':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        lines: b.lines.map((l, i) => {
          const incoming = action.patch[i + 1];
          if (incoming === undefined || l.locked) return l;
          return { ...l, text: incoming };
        }),
        status: 'idle',
        error: null,
        lastRunAt: Date.now()
      }));

    default:
      return state;
  }
}
