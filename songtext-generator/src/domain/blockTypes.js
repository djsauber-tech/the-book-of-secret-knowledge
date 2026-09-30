/**
 * Block-Typen. `role` entscheidet, welcher roleHint einer Strategie greift und
 * welche Rolle der Block im Story-Pfad spielt.
 */
export const BLOCK_TYPES = [
  { id: 'strophe', label: 'Strophe', role: 'strophe', defaultLines: 4 },
  { id: 'refrain', label: 'Refrain', role: 'refrain', defaultLines: 4 },
  { id: 'bridge', label: 'Bridge', role: 'bridge', defaultLines: 2 },
  { id: 'prechorus', label: 'Pre-Chorus', role: 'strophe', defaultLines: 2 },
  { id: 'hook', label: 'Hook', role: 'refrain', defaultLines: 2 },
  { id: 'outro', label: 'Outro', role: 'bridge', defaultLines: 2 }
];

export const BLOCK_TYPE_BY_ID = Object.fromEntries(BLOCK_TYPES.map((t) => [t.id, t]));

/**
 * Automatische Strategie-Zuweisung pro Block-Typ. Solange `autoStrategies`
 * aktiv ist, folgt der Block dieser Liste; sobald der Nutzer eingreift,
 * gewinnt seine Auswahl.
 */
export const AUTO_STRATEGIES = {
  strophe: ['show_dont_tell', 'story_path', 'image_stacking', 'shy', 'power_positions'],
  refrain: ['show_dont_tell', 'emotional_knot', 'power_positions'],
  bridge: ['emotional_knot', 'story_path', 'power_positions'],
  prechorus: ['emotional_knot', 'image_stacking', 'power_positions'],
  hook: ['show_dont_tell', 'power_positions'],
  outro: ['image_stacking', 'power_positions']
};

/** Menschlich lesbares Label inkl. Nummerierung, z.B. "Strophe 2". */
export function labelForBlock(block, index, blocks) {
  const type = BLOCK_TYPE_BY_ID[block.type];
  const sameType = blocks.filter((b) => b.type === block.type);
  if (sameType.length < 2) return type.label;
  return `${type.label} ${sameType.indexOf(block) + 1}`;
}

/** Ordinal innerhalb des eigenen Typs (1-basiert) - für Story-Pfad-Rollen. */
export function ordinalForBlock(block, blocks) {
  return blocks.filter((b) => b.type === block.type).indexOf(block) + 1;
}
