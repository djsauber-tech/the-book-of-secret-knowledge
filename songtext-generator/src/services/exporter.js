import { STATE_VERSION } from '../state/songReducer.js';
import { describeBlock, blockText } from '../state/selectors.js';

/** Songtext als reine Textdatei - das, was am Ende ins Studio geht. */
export function toPlainText(state) {
  const header = `${state.title}\n${'='.repeat(state.title.length)}\n`;
  const body = state.blocks
    .map((block) => `[${describeBlock(block, state.blocks).label}]\n${blockText(block)}`)
    .join('\n\n');
  return `${header}\n${body}\n`;
}

/**
 * Vollständiger Projektstand als JSON. API-Keys sind bewusst NICHT enthalten -
 * eine exportierte Datei soll teilbar sein, ohne ein Geheimnis mitzunehmen.
 */
export function toProjectJson(state) {
  return JSON.stringify(
    {
      kind: 'multi-llm-songtext-generator',
      version: STATE_VERSION,
      exportedAt: new Date().toISOString(),
      title: state.title,
      global: state.global,
      blocks: state.blocks.map((block) => ({
        ...block,
        status: 'idle',
        error: null,
        // Laufzeitballast fliegt raus: Varianten und Kritik sind an einen
        // konkreten Lauf gebunden und altern schlecht.
        variants: [],
        critique: null,
        history: []
      }))
    },
    null,
    2
  );
}

/** Liest eine Exportdatei zurück und prüft sie, bevor sie den State ersetzt. */
export function fromProjectJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Keine gültige JSON-Datei (${error.message})`);
  }
  if (parsed?.kind !== 'multi-llm-songtext-generator') {
    throw new Error('Datei stammt nicht aus diesem Generator');
  }
  if (parsed.version !== STATE_VERSION) {
    throw new Error(`Inkompatible Version (${parsed.version}, erwartet ${STATE_VERSION})`);
  }
  if (!Array.isArray(parsed.blocks)) throw new Error('Datei enthält keine Blöcke');

  return {
    title: typeof parsed.title === 'string' ? parsed.title : 'IMPORTIERTER SONG',
    global: {
      idea: parsed.global?.idea ?? '',
      vocabulary: parsed.global?.vocabulary ?? '',
      storyPath: parsed.global?.storyPath ?? 'situational'
    },
    blocks: parsed.blocks.map((block) => ({
      ...block,
      status: 'idle',
      error: null,
      variants: [],
      critique: null,
      history: [],
      lines: Array.isArray(block.lines) ? block.lines : []
    }))
  };
}

/** Browser-Download ohne Bibliothek. */
export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function filenameFor(state, extension) {
  const slug =
    state.title
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, '-')
      .replace(/^-|-$/g, '') || 'song';
  return `${slug}.${extension}`;
}
