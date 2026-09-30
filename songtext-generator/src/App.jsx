import React, { useState } from 'react';
import './styles/brutalism.css';
import SettingsPanel from './components/SettingsPanel.jsx';
import GlobalInputs from './components/GlobalInputs.jsx';
import StructureBuilder from './components/StructureBuilder.jsx';
import { Button } from './components/ui/Controls.jsx';
import { SongProvider, useDispatch, useSong } from './state/SongContext.jsx';
import { fullSongText } from './state/selectors.js';

function Masthead() {
  const state = useSong();
  const dispatch = useDispatch();
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(fullSongText(state));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <header className="masthead">
      <div className="masthead__inner">
        <h1 className="masthead__title">
          Multi-LLM <span>Songtext</span>-Generator
        </h1>
        <input
          className="masthead__title-input"
          value={state.title}
          onChange={(e) => dispatch({ type: 'SET_TITLE', value: e.target.value })}
          aria-label="Songtitel"
        />
        <span className="masthead__spacer" />
        <Button variant="ghost" onClick={copyAll}>
          {copied ? 'Kopiert' : 'Song kopieren'}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm('Song komplett zurücksetzen? Alle Blöcke und Texte gehen verloren.')) {
              dispatch({ type: 'RESET' });
            }
          }}
        >
          Reset
        </Button>
        <Button variant="primary" onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}>
          {state.ui.settingsOpen ? 'Settings ▲' : 'Settings ▼'}
        </Button>
      </div>
    </header>
  );
}

function Workspace() {
  const state = useSong();
  return (
    <div className="app">
      <Masthead />
      <main className="app__main">
        {state.ui.settingsOpen ? <SettingsPanel /> : null}
        <GlobalInputs />
        <StructureBuilder />
      </main>
      <footer className="footer">
        Lokaler Betrieb · Keys und Song liegen im localStorage dieses Browsers · Kein Backend
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <SongProvider>
      <Workspace />
    </SongProvider>
  );
}
