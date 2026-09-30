import assert from 'node:assert/strict';
import { songReducer, createInitialState, textFromLines } from '../src/state/songReducer.js';
import { buildRequest } from '../src/services/promptBuilder.js';
import { parseFullResponse, parseLinePatch } from '../src/services/generation.js';
import { lockedContextBlocks } from '../src/state/selectors.js';

let s = createInitialState();
const [strophe, refrain] = s.blocks;

s = songReducer(s, { type: 'SET_GLOBAL', field: 'idea', value: 'Letzter Nachtbus nach dem Streit' });
s = songReducer(s, { type: 'SET_GLOBAL', field: 'vocabulary', value: 'Nachtbus, Treppenhauslicht\nabgelaufene Monatskarte' });

// Strophe füllen und locken
s = songReducer(s, { type: 'SET_BLOCK_TEXT', blockId: strophe.id, value: 'Zeile A\nZeile B\nZeile C\nZeile D' });
s = songReducer(s, { type: 'TOGGLE_BLOCK_LOCK', blockId: strophe.id });
assert.equal(s.blocks[0].lines.length, 4);
assert.equal(s.blocks[0].locked, true);

// 1) Gelockter Block landet als Kontext im Refrain-Prompt
const ctx = lockedContextBlocks(s, refrain.id);
assert.equal(ctx.length, 1, 'gelockter Block muss im Kontext auftauchen');
const full = buildRequest(s, s.blocks[1], 'full');
assert.match(full.user, /FIXIERTER SONG-KONTEXT/);
assert.match(full.user, /Zeile C/, 'gelockter Text muss im Prompt stehen');
assert.match(full.user, /Nachtbus/, 'Vokabular-Pool muss im Prompt stehen');
assert.match(full.user, /Urteil/, 'Refrain-roleHint von show_dont_tell muss greifen');
assert.match(full.user, /SITUATIONSBASIERT/, 'Story-Pfad muss im Prompt stehen');
assert.equal(full.mode, 'full');

// 2) Micro-Editor: Zeile 1 und 3 locken -> nur 2 und 4 werden angefragt
s = songReducer(s, { type: 'SET_BLOCK_TEXT', blockId: refrain.id, value: 'R1\nR2\nR3\nR4' });
const rLines = s.blocks[1].lines;
s = songReducer(s, { type: 'TOGGLE_LINE_LOCK', blockId: refrain.id, lineId: rLines[0].id });
s = songReducer(s, { type: 'TOGGLE_LINE_LOCK', blockId: refrain.id, lineId: rLines[2].id });
const patchReq = buildRequest(s, s.blocks[1], 'lines');
assert.equal(patchReq.mode, 'lines');
assert.deepEqual(patchReq.expectedLineNumbers, [2, 4]);
assert.match(patchReq.user, /1: \[GELOCKT - UNVERÄNDERBAR\] R1/);
assert.match(patchReq.user, /Gib genau diese Nummern zurück: 2, 4/);

// 3) Patch-Parsing: nur erwartete Nummern, Müll fliegt raus
const patch = parseLinePatch('Hier bitte:\n1: GEKLAUT\n2: neue Zeile zwei\n4. neue Zeile vier\n7: fremd', [2, 4]);
assert.deepEqual(patch, { 2: 'neue Zeile zwei', 4: 'neue Zeile vier' });

s = songReducer(s, { type: 'GENERATION_PATCHED', blockId: refrain.id, patch });
assert.equal(textFromLines(s.blocks[1].lines), 'R1\nneue Zeile zwei\nR3\nneue Zeile vier');

// 4) Vollersatz respektiert gelockte Zeilen
s = songReducer(s, {
  type: 'GENERATION_REPLACED',
  blockId: refrain.id,
  lines: ['X1', 'X2']
});
const after = textFromLines(s.blocks[1].lines);
assert.equal(after, 'R1\nX1\nR3\nX2', `gelockte Zeilen müssen stehen bleiben, war: ${after}`);

// 5) Antwort-Cleanup
assert.deepEqual(parseFullResponse('```\n1. Erste Zeile\n- Zweite Zeile\n\n[Refrain]\n"Dritte Zeile"\n```'), [
  'Erste Zeile',
  'Zweite Zeile',
  'Dritte Zeile'
]);

// 6) Auto-Strategien folgen dem Block-Typ, manuelle Auswahl gewinnt
let t = songReducer(createInitialState(), { type: 'ADD_BLOCK', blockType: 'bridge' });
const bridge = t.blocks[2];
assert.ok(bridge.strategies.includes('emotional_knot'));
t = songReducer(t, { type: 'TOGGLE_STRATEGY', blockId: bridge.id, strategyId: 'shy' });
assert.equal(t.blocks[2].autoStrategies, false);
assert.ok(t.blocks[2].strategies.includes('shy'));

console.log('SMOKE OK — alle 6 Prüfungen bestanden');
