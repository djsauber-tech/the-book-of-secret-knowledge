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
    // Laufzeit-Beiwerk: Varianten-Duell, Kreuz-Kritik, Änderungsverlauf
    variants: [],
    critique: null,
    history: [],
    stream: null,
    notice: null,
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

/**
 * Übernimmt neue Zeilentexte, ohne gelockte Zeilen anzutasten: gelockte Zeilen
 * bleiben an ihrer Position, der Nachschub füllt nur die freien Plätze auf.
 * Gemeinsame Basis von Vollersatz und Variantenübernahme.
 */
function mergeRespectingLocks(existingLines, incomingTexts) {
  const incoming = [...incomingTexts];
  const merged = [];
  const count = Math.max(existingLines.length, incomingTexts.length);
  for (let i = 0; i < count; i += 1) {
    const existing = existingLines[i];
    if (existing?.locked) {
      merged.push(existing);
      continue;
    }
    const text = incoming.shift();
    if (text === undefined) continue;
    merged.push(existing ? { ...existing, text } : createLine(text));
  }
  return merged;
}

const HISTORY_LIMIT = 20;

/**
 * Jede Änderung, die von einem Modell kommt, legt vorher einen Schnappschuss
 * ab. Restore ist damit ein gewöhnlicher Zustandswechsel und braucht keine
 * eigene Undo-Mechanik.
 */
function pushHistory(block, entry) {
  const snapshot = {
    id: nextId('hist'),
    at: Date.now(),
    lines: block.lines.map((l) => ({ ...l })),
    ...entry
  };
  return [snapshot, ...block.history].slice(0, HISTORY_LIMIT);
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
        variants: [],
        critique: null,
        history: [],
        stream: null,
        notice: null,
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
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        status: 'running',
        error: null,
        notice: null,
        stream: null
      }));

    case 'GENERATION_DELTA':
      return mapBlock(state, action.blockId, (b) => ({ ...b, stream: action.text }));

    /** Hinweis aus der Transportschicht, z.B. "Rate-Limit, neuer Versuch in 2s". */
    case 'GENERATION_NOTICE':
      return mapBlock(state, action.blockId, (b) => ({ ...b, notice: action.notice }));

    case 'GENERATION_FAILED':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        status: 'error',
        error: action.error,
        stream: null,
        notice: null
      }));

    case 'GENERATION_ABORTED':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        status: 'idle',
        error: null,
        stream: null,
        notice: null
      }));

    /**
     * Vollersatz: alle Zeilen neu. Gelockte Zeilen bleiben unangetastet, damit
     * ein versehentlicher Voll-Run keine fertige Zeile zerstört.
     */
    case 'GENERATION_REPLACED':
      return mapBlock(state, action.blockId, (b) => {
        return {
          ...b,
          lines: mergeRespectingLocks(b.lines, action.lines),
          status: 'idle',
          error: null,
          stream: null,
          notice: null,
          lastRunAt: Date.now(),
          history: pushHistory(b, { kind: 'Vollersatz', provider: b.provider, model: b.model })
        };
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
        stream: null,
        notice: null,
        lastRunAt: Date.now(),
        history: pushHistory(b, {
          kind: `Zeilen ${Object.keys(action.patch).join(', ')}`,
          provider: b.provider,
          model: b.model
        })
      }));

    /* ---------------- Historie ---------------- */

    case 'RESTORE_HISTORY':
      return mapBlock(state, action.blockId, (b) => {
        const entry = b.history.find((h) => h.id === action.entryId);
        if (!entry) return b;
        return {
          ...b,
          lines: entry.lines.map((l) => ({ ...l })),
          history: pushHistory(b, { kind: 'vor Wiederherstellung', provider: b.provider, model: b.model })
        };
      });

    case 'CLEAR_HISTORY':
      return mapBlock(state, action.blockId, (b) => ({ ...b, history: [] }));

    /* ---------------- Varianten-Duell ---------------- */

    case 'VARIANTS_RECEIVED':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        status: 'idle',
        error: null,
        stream: null,
        notice: action.failures?.length ? action.failures.join(' | ') : null,
        variants: action.variants.map((v, i) => ({ id: `${Date.now()}_${i}`, ...v }))
      }));

    case 'CLEAR_VARIANTS':
      return mapBlock(state, action.blockId, (b) => ({ ...b, variants: [] }));

    /** Ganze Variante übernehmen - gelockte Zeilen bleiben auch hier stehen. */
    case 'ADOPT_VARIANT':
      return mapBlock(state, action.blockId, (b) => {
        const variant = b.variants.find((v) => v.id === action.variantId);
        if (!variant) return b;
        return {
          ...b,
          lines: mergeRespectingLocks(b.lines, variant.lines),
          provider: variant.provider,
          model: variant.model,
          history: pushHistory(b, {
            kind: 'vor Variantenübernahme',
            provider: b.provider,
            model: b.model
          })
        };
      });

    /**
     * Einzelne Zeile aus einer Variante ziehen. Zeile 3 der Variante wird auch
     * dann Zeile 3 des Blocks, wenn der Block noch kürzer ist - dazwischen
     * entstehen leere Zeilen, statt die Position stillschweigend zu verschieben.
     */
    case 'ADOPT_VARIANT_LINE':
      return mapBlock(state, action.blockId, (b) => {
        const variant = b.variants.find((v) => v.id === action.variantId);
        const text = variant?.lines[action.lineIndex];
        if (text === undefined) return b;
        const target = b.lines[action.lineIndex];
        if (target?.locked) return b;

        const lines = [...b.lines];
        while (lines.length < action.lineIndex) lines.push(createLine(''));
        if (target) lines[action.lineIndex] = { ...target, text };
        else lines.push(createLine(text));
        return { ...b, lines };
      });

    /* ---------------- Kreuz-Kritik ---------------- */

    case 'CRITIQUE_START':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        critique: { status: 'running', findings: [], reviewer: action.reviewer, error: null }
      }));

    case 'CRITIQUE_RECEIVED':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        critique: {
          status: 'done',
          findings: action.findings,
          reviewer: action.reviewer,
          error: null,
          at: Date.now()
        }
      }));

    case 'CRITIQUE_FAILED':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        critique: { status: 'error', findings: [], reviewer: action.reviewer, error: action.error }
      }));

    case 'CLEAR_CRITIQUE':
      return mapBlock(state, action.blockId, (b) => ({ ...b, critique: null }));

    /** Vorschlag eines Befunds in die betroffene Zeile übernehmen. */
    case 'APPLY_FINDING':
      return mapBlock(state, action.blockId, (b) => {
        const finding = b.critique?.findings.find((f) => f.id === action.findingId);
        if (!finding?.suggestion || !finding.line) return b;
        const index = finding.line - 1;
        const target = b.lines[index];
        if (!target || target.locked) return b;
        const lines = [...b.lines];
        lines[index] = { ...target, text: finding.suggestion };
        return {
          ...b,
          lines,
          critique: {
            ...b.critique,
            findings: b.critique.findings.map((f) =>
              f.id === action.findingId ? { ...f, applied: true } : f
            )
          },
          history: pushHistory(b, { kind: 'vor Kritik-Übernahme', provider: b.provider, model: b.model })
        };
      });

    case 'DISMISS_FINDING':
      return mapBlock(state, action.blockId, (b) => ({
        ...b,
        critique: b.critique
          ? {
              ...b.critique,
              findings: b.critique.findings.filter((f) => f.id !== action.findingId)
            }
          : null
      }));

    /* ---------------- Import ---------------- */

    case 'IMPORT_PROJECT':
      return {
        ...createInitialState(),
        title: action.project.title,
        global: action.project.global,
        blocks: action.project.blocks
      };

    default:
      return state;
  }
}
