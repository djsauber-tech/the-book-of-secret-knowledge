import { BLOCK_TYPE_BY_ID, labelForBlock, ordinalForBlock } from '../domain/blockTypes.js';
import { STRATEGY_BY_ID, STORY_PATH_BY_ID } from '../domain/strategies.js';
import { PROVIDER_BY_ID } from '../domain/providers.js';
import { textFromLines } from './songReducer.js';

/** Reicht Label und Ordinal an die UI und den Prompt-Builder weiter. */
export function describeBlock(block, blocks) {
  const index = blocks.indexOf(block);
  return {
    index,
    label: labelForBlock(block, index, blocks),
    ordinal: ordinalForBlock(block, blocks),
    typeDef: BLOCK_TYPE_BY_ID[block.type]
  };
}

export function blockText(block) {
  return textFromLines(block.lines);
}

export function hasText(block) {
  return block.lines.some((l) => l.text.trim() !== '');
}

/**
 * Kern von Anforderung 4: alle gelockten Blöcke - außer dem gerade
 * bearbeiteten - in Songreihenfolge, als fester Kontext für den API-Aufruf.
 */
export function lockedContextBlocks(state, exceptBlockId = null) {
  return state.blocks
    .filter((b) => b.locked && b.id !== exceptBlockId && hasText(b))
    .map((b) => ({
      id: b.id,
      label: describeBlock(b, state.blocks).label,
      text: blockText(b)
    }));
}

/** Zeilenstatus für den Micro-Editor: welche Zeilen sind fixiert, welche frei? */
export function lineState(block) {
  const locked = [];
  const free = [];
  block.lines.forEach((line, i) => {
    (line.locked ? locked : free).push({ number: i + 1, ...line });
  });
  return { locked, free, total: block.lines.length };
}

export function activeStrategies(block) {
  return block.strategies.map((id) => STRATEGY_BY_ID[id]).filter(Boolean);
}

export function activeStoryPath(state) {
  return STORY_PATH_BY_ID[state.global.storyPath];
}

/** Ein Block ist generierbar, sobald Grundidee und ein Provider-Key da sind. */
export function blockReadiness(state, block, keys) {
  const problems = [];
  if (!state.global.idea.trim()) problems.push('Grundidee fehlt');
  const provider = PROVIDER_BY_ID[block.provider];
  if (!keys[provider.keyField]?.trim()) problems.push(`API-Key (${provider.vendor}) fehlt`);
  if (block.locked) problems.push('Block ist gelockt');
  return { ok: problems.length === 0, problems };
}

/** Volltext des Songs, in Songreihenfolge, für Export/Clipboard. */
export function fullSongText(state) {
  return state.blocks
    .map((b) => `[${describeBlock(b, state.blocks).label}]\n${blockText(b)}`)
    .join('\n\n');
}
