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



/* ===================== Erweiterungen: Duell, Kritik, Silben, Export ===== */

import { syllablesInLine, syllablesInWord, meterProfile, meterInstruction } from '../src/services/syllables.js';
import { parseCritique, reviewerFor } from '../src/services/critique.js';
import { toPlainText, toProjectJson, fromProjectJson } from '../src/services/exporter.js';

// 7) Silbenzählung und Metrik-Ableitung
assert.equal(syllablesInWord('Treppenhauslicht'), 4);
assert.equal(syllablesInLine('Der Fahrer zählt mein Kleingeld nach'), 8);

let m = createInitialState();
const mBlock = m.blocks[0];
m = songReducer(m, { type: 'SET_BLOCK_TEXT', blockId: mBlock.id, value: 'Der Fahrer zählt mein Kleingeld nach\nkurz\nDein Name steht noch im Display\nnoch kürzer' });
const mLines = m.blocks[0].lines;
m = songReducer(m, { type: 'TOGGLE_LINE_LOCK', blockId: mBlock.id, lineId: mLines[0].id });
m = songReducer(m, { type: 'TOGGLE_LINE_LOCK', blockId: mBlock.id, lineId: mLines[2].id });
const profile = meterProfile(m.blocks[0]);
assert.equal(profile.target, 8, 'Zielmaß kommt aus den gelockten Zeilen');
assert.match(meterInstruction(m.blocks[0]), /Zielwert 8/);
// Die Silbenvorgabe muss auch wirklich im Micro-Edit-Prompt landen
assert.match(buildRequest(m, m.blocks[0], 'lines').user, /SILBENVORGABE/);

// 8) Kritik-Parsing: Codefence, Prosa und Schrott werden verworfen
const findings = parseCritique('Analyse:\n```json\n[{"line":2,"severity":"hart","strategy":"Image Stacking","problem":"Klischee","suggestion":"Neonschrift flackert zweimal"},{"kaputt":1}]\n```');
assert.equal(findings.length, 1);
assert.equal(findings[0].line, 2);

// 9) Prüfer ist standardmäßig das ANDERE Modell
const bothKeys = { anthropic: 'a', google: 'g' };
assert.equal(reviewerFor({ provider: 'claude' }, bothKeys).provider, 'gemini');
assert.equal(reviewerFor({ provider: 'claude' }, bothKeys).isCross, true);
// Nur ein Key: Selbstkritik, aber ehrlich markiert
assert.equal(reviewerFor({ provider: 'claude' }, { anthropic: 'a', google: '' }).isCross, false);
assert.equal(reviewerFor({ provider: 'claude' }, { anthropic: '', google: '' }), null);

// 10) Befund übernehmen schreibt in die Zeile, respektiert aber Locks
let c = createInitialState();
const cBlock = c.blocks[0];
c = songReducer(c, { type: 'SET_BLOCK_TEXT', blockId: cBlock.id, value: 'A\nB\nC' });
c = songReducer(c, {
  type: 'CRITIQUE_RECEIVED',
  blockId: cBlock.id,
  reviewer: { provider: 'gemini', model: 'gemini-2.5-pro', isCross: true },
  findings: [
    { id: 'f1', line: 2, severity: 'hart', strategy: null, problem: 'x', suggestion: 'B neu' },
    { id: 'f2', line: 3, severity: 'hart', strategy: null, problem: 'y', suggestion: 'C neu' }
  ]
});
c = songReducer(c, { type: 'TOGGLE_LINE_LOCK', blockId: cBlock.id, lineId: c.blocks[0].lines[2].id });
c = songReducer(c, { type: 'APPLY_FINDING', blockId: cBlock.id, findingId: 'f1' });
c = songReducer(c, { type: 'APPLY_FINDING', blockId: cBlock.id, findingId: 'f2' });
assert.equal(textFromLines(c.blocks[0].lines), 'A\nB neu\nC', 'gelockte Zeile 3 bleibt unangetastet');
assert.equal(c.blocks[0].history.length, 1, 'nur die wirksame Übernahme legt einen Schnappschuss ab');

// 11) Variante zeilenweise übernehmen, Lock gewinnt
let v = createInitialState();
const vBlock = v.blocks[0];
v = songReducer(v, { type: 'SET_BLOCK_TEXT', blockId: vBlock.id, value: 'alt1\nalt2' });
v = songReducer(v, { type: 'TOGGLE_LINE_LOCK', blockId: vBlock.id, lineId: v.blocks[0].lines[0].id });
v = songReducer(v, {
  type: 'VARIANTS_RECEIVED',
  blockId: vBlock.id,
  variants: [{ provider: 'gemini', model: 'gemini-2.5-pro', lines: ['neu1', 'neu2'], raw: '' }],
  failures: []
});
const variantId = v.blocks[0].variants[0].id;
v = songReducer(v, { type: 'ADOPT_VARIANT_LINE', blockId: vBlock.id, variantId, lineIndex: 0 });
assert.equal(textFromLines(v.blocks[0].lines), 'alt1\nalt2', 'gelockte Zielzeile nimmt nichts an');
v = songReducer(v, { type: 'ADOPT_VARIANT', blockId: vBlock.id, variantId });
assert.equal(textFromLines(v.blocks[0].lines), 'alt1\nneu1', 'Vollübernahme füllt nur die freien Plätze');

// 12) Verlauf wiederherstellen
let h = createInitialState();
const hBlock = h.blocks[0];
h = songReducer(h, { type: 'SET_BLOCK_TEXT', blockId: hBlock.id, value: 'erste Fassung' });
h = songReducer(h, { type: 'GENERATION_REPLACED', blockId: hBlock.id, lines: ['zweite Fassung'] });
assert.equal(h.blocks[0].history.length, 1);
const snapshotId = h.blocks[0].history[0].id;
h = songReducer(h, { type: 'RESTORE_HISTORY', blockId: hBlock.id, entryId: snapshotId });
assert.equal(textFromLines(h.blocks[0].lines), 'erste Fassung');

// 13) Export enthält keine Keys und lässt sich zurücklesen
const json = toProjectJson(h);
assert.ok(!/anthropic|sk-ant|AIza/i.test(json), 'Export darf keine Keys enthalten');
const reimported = fromProjectJson(json);
assert.equal(reimported.blocks.length, h.blocks.length);
assert.match(toPlainText(h), /\[Strophe\]/);
assert.throws(() => fromProjectJson('{"kind":"etwas anderes"}'), /nicht aus diesem Generator/);



// 14) Zeile aus Variante behält ihre Position, auch im noch leeren Block
let e = createInitialState();
const eBlock = e.blocks[1];
e = songReducer(e, {
  type: 'VARIANTS_RECEIVED',
  blockId: eBlock.id,
  variants: [{ provider: 'claude', model: 'claude-opus-5', lines: ['v1', 'v2', 'v3'], raw: '' }],
  failures: []
});
const vId = e.blocks[1].variants[0].id;
e = songReducer(e, { type: 'ADOPT_VARIANT_LINE', blockId: eBlock.id, variantId: vId, lineIndex: 2 });
assert.equal(e.blocks[1].lines.length, 3, 'Position 3 bleibt Position 3');
assert.equal(textFromLines(e.blocks[1].lines), '\n\nv3');

console.log('SMOKE OK — alle 14 Prüfungen bestanden');
