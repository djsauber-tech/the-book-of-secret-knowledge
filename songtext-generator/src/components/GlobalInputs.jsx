import React from 'react';
import { Field, Panel, Select, TextArea } from './ui/Controls.jsx';
import { useDispatch, useSong } from '../state/SongContext.jsx';
import { STORY_PATHS } from '../domain/strategies.js';

/** Globaler Input (Anforderung 2) + global gewählter Story-Pfad (Strategie 3). */
export default function GlobalInputs() {
  const state = useSong();
  const dispatch = useDispatch();

  const set = (field) => (e) => dispatch({ type: 'SET_GLOBAL', field, value: e.target.value });
  const vocabCount = state.global.vocabulary
    .split(/[\n,;]+/)
    .map((w) => w.trim())
    .filter(Boolean).length;

  return (
    <Panel title="Globaler Input" neon>
      <Field label="Grundidee / Thema" hint="Geht in jeden Block-Prompt ein.">
        <TextArea
          rows={5}
          value={state.global.idea}
          onChange={set('idea')}
          placeholder={'Worum geht es? Situation, Figuren, Ort, Zeitpunkt, was auf dem Spiel steht.'}
        />
      </Field>

      <Field
        label="Vokabular-Pool"
        hint={`${vocabCount} Eintrag/Einträge — getrennt durch Komma, Semikolon oder Zeilenumbruch. Jeder Eintrag muss wörtlich vorkommen.`}
      >
        <TextArea
          rows={5}
          value={state.global.vocabulary}
          onChange={set('vocabulary')}
          placeholder={'Nachtbus, abgelaufene Monatskarte, "du hast nie gefragt", Treppenhauslicht'}
        />
      </Field>

      <Field
        label="Story-Pfad (Strategie 3)"
        hint={STORY_PATHS.find((p) => p.id === state.global.storyPath)?.directive}
      >
        <Select
          value={state.global.storyPath}
          onChange={set('storyPath')}
          options={STORY_PATHS.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Field>
    </Panel>
  );
}
