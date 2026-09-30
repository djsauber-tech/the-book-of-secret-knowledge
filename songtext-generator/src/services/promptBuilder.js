import { activeStoryPath, activeStrategies, describeBlock, lineState, lockedContextBlocks } from '../state/selectors.js';

const BASE_SYSTEM = [
  'Du bist ein deutschsprachiger Songtexter mit einem kompromisslosen Anti-Klischee-Filter.',
  'Du schreibst ausschließlich auf Deutsch, singbar, ohne Reimzwang und ohne Füllwörter.',
  'Verboten sind: generische Wetter- und Zeitmetaphern (Regen als Trauer, Sonne als Glück),',
  'abstrakte Gefühlsbegriffe als Selbstzweck ("Schmerz", "Sehnsucht", "Liebe" als Aussage),',
  'Plattitüden, Reim-Klischees (Herz/Schmerz, Zeit/Ewigkeit) und erklärende Meta-Zeilen.',
  'Du lieferst nur Songtext - keine Einleitung, keine Überschrift, keine Kommentare, keine Erklärung.'
].join(' ');

/** Zeilennummer-Raster: gelockte Zeilen wörtlich, freie als Platzhalter. */
function renderLineGrid(block) {
  return block.lines
    .map((line, i) => {
      const n = i + 1;
      if (line.locked) return `${n}: [GELOCKT - UNVERÄNDERBAR] ${line.text}`;
      const current = line.text.trim();
      return current
        ? `${n}: [FREI - ERSETZEN] (bisher: ${current})`
        : `${n}: [FREI - NEU SCHREIBEN]`;
    })
    .join('\n');
}

function renderStrategySection(block, role) {
  const strategies = activeStrategies(block);
  if (strategies.length === 0) {
    return 'HERANGEHENSWEISEN: keine ausgewählt - halte dich an die allgemeinen Verbote.';
  }
  const rendered = strategies.map((strategy, i) => {
    const hint = strategy.roleHints?.[role];
    return [`${i + 1}. ${strategy.directive}`, hint ? `   ROLLE DIESES BLOCKS: ${hint}` : null]
      .filter(Boolean)
      .join('\n');
  });
  return [
    'VERBINDLICHE HERANGEHENSWEISEN (jede einzelne MUSS erfüllt sein):',
    ...rendered
  ].join('\n');
}

function renderStoryPathSection(state, block, role, ordinal) {
  const path = activeStoryPath(state);
  if (!path) return null;
  const key = role === 'strophe' ? (ordinal <= 2 ? `strophe:${ordinal}` : 'strophe:n') : role;
  const blockRole = path.roles[key];
  return [
    `STORY-PFAD: ${path.name}`,
    path.directive,
    blockRole ? `ROLLE DIESES BLOCKS IM PFAD: ${blockRole}` : null
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Anforderung 4: der Text aller gelockten Blöcke geht als fester,
 * unveränderbarer Kontext mit - damit die KI Bezüge herstellen kann.
 */
function renderLockedContext(state, block) {
  const locked = lockedContextBlocks(state, block.id);
  if (locked.length === 0) {
    return 'FIXIERTER SONG-KONTEXT: noch keine Blöcke gelockt. Dieser Block setzt den Ton.';
  }
  return [
    'FIXIERTER SONG-KONTEXT (bereits fertig und gelockt - NICHT verändern, nur darauf beziehen):',
    ...locked.map((b) => `--- ${b.label} ---\n${b.text}`),
    'Stelle klare inhaltliche und bildliche Bezüge zu diesen Blöcken her, ohne sie zu wiederholen.'
  ].join('\n\n');
}

function renderVocabulary(state) {
  const pool = state.global.vocabulary
    .split(/[\n,;]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (pool.length === 0) return null;
  return [
    'VOKABULAR-POOL (jedes dieser Wörter/Phrasen MUSS wörtlich im Text vorkommen,',
    'grammatisch eingepasst, aber erkennbar):',
    pool.map((w) => `- ${w}`).join('\n')
  ].join('\n');
}

/**
 * Baut den vollständigen Request für einen Block.
 *
 * mode = 'full'  -> alle freien Zeilen neu, Antwort ist reiner Songtext
 * mode = 'lines' -> nur die freien Zeilen, Antwort ist "<nr>: <text>" pro Zeile
 *
 * Rückgabe ist provider-neutral; die Adapter in services/providers mappen
 * `system` und `user` auf das jeweilige API-Format.
 */
export function buildRequest(state, block, mode = 'full') {
  const { label, ordinal, typeDef } = describeBlock(block, state.blocks);
  const role = typeDef.role;
  const { locked, free, total } = lineState(block);
  const effectiveMode = mode === 'lines' && locked.length > 0 && free.length > 0 ? 'lines' : 'full';

  const sections = [
    `AUFGABE: Schreibe den Block "${label}" (Typ: ${typeDef.label}) eines deutschen Songs.`,
    `GRUNDIDEE / THEMA:\n${state.global.idea.trim() || '(nicht angegeben)'}`,
    renderVocabulary(state),
    renderStoryPathSection(state, block, role, ordinal),
    renderStrategySection(block, role),
    renderLockedContext(state, block),
    block.prompt.trim() ? `SPEZIFISCHE ANWEISUNG FÜR DIESEN BLOCK:\n${block.prompt.trim()}` : null
  ];

  if (effectiveMode === 'lines') {
    sections.push(
      [
        'ZEILENBASIERTER AUFTRAG (MICRO-EDIT):',
        `Der Block hat ${total} Zeilen. Gelockte Zeilen sind unveränderbar und bleiben exakt stehen.`,
        'Schreibe ausschließlich die als FREI markierten Zeilen neu, passend zu den gelockten Zeilen',
        '(Metrik, Silbenzahl, Bildsprache, Reimlage).',
        '',
        renderLineGrid(block),
        '',
        `AUSGABEFORMAT: eine Zeile pro freier Zeilennummer, exakt "<nr>: <text>".`,
        `Gib genau diese Nummern zurück: ${free.map((l) => l.number).join(', ')}.`,
        'Keine gelockten Nummern, keine Leerzeilen, kein weiterer Text.'
      ].join('\n')
    );
  } else {
    sections.push(
      [
        'AUSGABEFORMAT:',
        `Gib genau ${block.targetLines} Songzeilen aus, eine pro Zeile, ohne Nummerierung,`,
        'ohne Anführungszeichen, ohne Blocklabel, ohne Kommentar.'
      ].join('\n')
    );
    if (locked.length > 0) {
      sections.push(
        [
          'ACHTUNG: folgende Zeilen dieses Blocks sind gelockt und bleiben clientseitig erhalten.',
          'Schreibe passend dazu, wiederhole sie aber nicht:',
          locked.map((l) => `${l.number}: ${l.text}`).join('\n')
        ].join('\n')
      );
    }
  }

  return {
    mode: effectiveMode,
    blockId: block.id,
    provider: block.provider,
    model: block.model,
    system: BASE_SYSTEM,
    user: sections.filter(Boolean).join('\n\n'),
    expectedLineNumbers: effectiveMode === 'lines' ? free.map((l) => l.number) : null
  };
}

/** Für das Prompt-Preview-Panel: der komplette Payload als Klartext. */
export function renderRequestForPreview(request) {
  return [
    `# PROVIDER: ${request.provider} / ${request.model}`,
    `# MODUS: ${request.mode}`,
    '',
    '=== SYSTEM ===',
    request.system,
    '',
    '=== USER ===',
    request.user
  ].join('\n');
}
