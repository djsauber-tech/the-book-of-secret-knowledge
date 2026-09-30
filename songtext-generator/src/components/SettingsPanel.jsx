import React, { useState } from 'react';
import { Button, Field, Panel, TextInput } from './ui/Controls.jsx';
import { useKeys } from '../state/SongContext.jsx';
import { PROVIDERS } from '../domain/providers.js';

/**
 * Versteckbares Settings-Panel (Anforderung 1). Die Keys liegen ausschließlich
 * im localStorage dieses Browsers.
 */
export default function SettingsPanel() {
  const { keys, setKey, clearKeys } = useKeys();
  const [reveal, setReveal] = useState(false);

  return (
    <Panel
      title="API-Konfiguration"
      className="panel--settings"
      actions={
        <>
          <Button variant="ghost" onClick={() => setReveal((v) => !v)}>
            {reveal ? 'Verbergen' : 'Anzeigen'}
          </Button>
          <Button variant="danger" onClick={clearKeys}>
            Keys löschen
          </Button>
        </>
      }
    >
      {PROVIDERS.map((provider) => (
        <Field
          key={provider.id}
          label={`${provider.vendor} — ${provider.label}`}
          hint={
            keys[provider.keyField]?.trim()
              ? `Key hinterlegt (${keys[provider.keyField].trim().length} Zeichen)`
              : 'Kein Key hinterlegt — Blöcke mit diesem Modell sind gesperrt.'
          }
        >
          <TextInput
            type={reveal ? 'text' : 'password'}
            value={keys[provider.keyField] ?? ''}
            onChange={(e) => setKey(provider.keyField, e.target.value)}
            placeholder={provider.id === 'claude' ? 'sk-ant-...' : 'AIza...'}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      ))}
      <p className="notice">
        Die Keys werden nur lokal im Browser gespeichert und gehen ausschließlich an
        api.anthropic.com bzw. generativelanguage.googleapis.com. Diese App ist für den lokalen
        Betrieb gedacht — nicht öffentlich deployen.
      </p>
    </Panel>
  );
}
