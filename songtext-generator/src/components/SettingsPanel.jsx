import React, { useState } from 'react';
import { Button, Field, Panel, TextInput } from './ui/Controls.jsx';
import { useKeys } from '../state/SongContext.jsx';
import { PROVIDERS } from '../domain/providers.js';
import { testConnection } from '../services/diagnostics.js';

/**
 * Versteckbares Settings-Panel (Anforderung 1). Die Keys liegen ausschließlich
 * im localStorage dieses Browsers.
 *
 * Der Verbindungstest macht einen minimalen echten Aufruf pro Anbieter - damit
 * sich Key, Netzzugang und Modellname klären lassen, bevor der erste richtige
 * Lauf daran scheitert.
 */
export default function SettingsPanel() {
  const { keys, setKey, clearKeys } = useKeys();
  const [reveal, setReveal] = useState(false);
  const [results, setResults] = useState({});
  const [testing, setTesting] = useState([]);

  const runTest = async (providerId) => {
    setTesting((ids) => [...ids, providerId]);
    setResults((prev) => ({ ...prev, [providerId]: null }));
    try {
      const result = await testConnection(providerId, keys);
      setResults((prev) => ({ ...prev, [providerId]: result }));
    } finally {
      setTesting((ids) => ids.filter((id) => id !== providerId));
    }
  };

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
      {PROVIDERS.map((provider) => {
        const key = keys[provider.keyField] ?? '';
        const result = results[provider.id];
        const busy = testing.includes(provider.id);

        return (
          <div key={provider.id} className="provider-row">
            <Field
              label={`${provider.vendor} — ${provider.label}`}
              hint={
                key.trim()
                  ? `Key hinterlegt (${key.trim().length} Zeichen)`
                  : 'Kein Key hinterlegt — Blöcke mit diesem Modell sind gesperrt.'
              }
            >
              <TextInput
                type={reveal ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(provider.keyField, e.target.value)}
                placeholder={provider.id === 'claude' ? 'sk-ant-...' : 'AIza...'}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <div className="btn-row" style={{ marginTop: 8 }}>
              <Button disabled={!key.trim() || busy} onClick={() => runTest(provider.id)}>
                {busy ? 'Teste …' : 'Verbindung testen'}
              </Button>
              {result?.ok ? (
                <span className="tag tag--on">
                  OK · {result.model} · {result.latencyMs} ms
                </span>
              ) : null}
            </div>

            {result && !result.ok ? (
              <div className="diagnosis">
                <strong className="diagnosis__headline">{result.headline}</strong>
                <span className="diagnosis__remedy">{result.remedy}</span>
              </div>
            ) : null}
          </div>
        );
      })}

      <p className="notice">
        Die Keys werden nur lokal im Browser gespeichert und gehen ausschließlich an
        api.anthropic.com bzw. generativelanguage.googleapis.com. Diese App ist für den lokalen
        Betrieb gedacht — nicht öffentlich deployen.
      </p>
    </Panel>
  );
}
