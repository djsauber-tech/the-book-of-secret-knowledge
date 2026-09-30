import React, { useState } from 'react';
import { Button, Checkbox, Field, Select, TextArea } from './ui/Controls.jsx';
import StrategySelector from './StrategySelector.jsx';
import LineEditor from './LineEditor.jsx';
import VariantDuel from './VariantDuel.jsx';
import CritiquePanel from './CritiquePanel.jsx';
import HistoryPanel from './HistoryPanel.jsx';
import { useDispatch, useKeys, useSong } from '../state/SongContext.jsx';
import { BLOCK_TYPES } from '../domain/blockTypes.js';
import { PROVIDERS, PROVIDER_BY_ID } from '../domain/providers.js';
import { blockReadiness, blockText, describeBlock, lockedContextBlocks } from '../state/selectors.js';
import { buildRequest, renderRequestForPreview } from '../services/promptBuilder.js';

export default function SongBlock({ block, onGenerate, onDuel, onCritique, onAbort, busy }) {
  const state = useSong();
  const dispatch = useDispatch();
  const { keys } = useKeys();
  const [showHistory, setShowHistory] = useState(false);

  const { index, label } = describeBlock(block, state.blocks);
  const readiness = blockReadiness(state, block, keys);
  const context = lockedContextBlocks(state, block.id);
  const inspecting = state.ui.inspectBlockId === block.id;
  const provider = PROVIDER_BY_ID[block.provider];
  const hasLines = block.lines.some((l) => l.text.trim() !== '');

  const statusClass =
    block.status === 'running'
      ? 'block--running'
      : block.status === 'error'
        ? 'block--error'
        : block.locked
          ? 'block--locked'
          : '';

  const setField = (field) => (value) =>
    dispatch({ type: 'SET_BLOCK_FIELD', blockId: block.id, field, value });

  return (
    <article className={`block ${statusClass}`}>
      <header className="block__head">
        <span className="block__index">{String(index + 1).padStart(2, '0')}</span>
        <span className="block__label">{label}</span>
        <span className={`tag ${block.provider === 'claude' ? 'tag--on' : 'tag--warn'}`}>
          {provider.label}
        </span>
        {block.status === 'running' ? <span className="tag tag--warn">generiert …</span> : null}
        {block.status === 'error' ? <span className="tag tag--alarm">Fehler</span> : null}
        <span className="block__spacer" />

        <Checkbox
          checked={block.locked}
          onChange={() => dispatch({ type: 'TOGGLE_BLOCK_LOCK', blockId: block.id })}
          label="Lock / Fertig"
        />
        <Button variant="ghost" onClick={() => dispatch({ type: 'MOVE_BLOCK', blockId: block.id, delta: -1 })} title="Nach oben">
          ↑
        </Button>
        <Button variant="ghost" onClick={() => dispatch({ type: 'MOVE_BLOCK', blockId: block.id, delta: 1 })} title="Nach unten">
          ↓
        </Button>
        <Button variant="ghost" onClick={() => dispatch({ type: 'DUPLICATE_BLOCK', blockId: block.id })} title="Duplizieren">
          ⧉
        </Button>
        <Button variant="danger" onClick={() => dispatch({ type: 'REMOVE_BLOCK', blockId: block.id })} title="Block entfernen">
          ✕
        </Button>
      </header>

      <div className="block__config">
        <Field label="Block-Typ">
          <Select
            value={block.type}
            onChange={(e) => dispatch({ type: 'SET_BLOCK_TYPE', blockId: block.id, value: e.target.value })}
            options={BLOCK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
          />
        </Field>

        <Field label="Ausführende KI">
          <Select
            value={block.provider}
            onChange={(e) => dispatch({ type: 'SET_BLOCK_PROVIDER', blockId: block.id, value: e.target.value })}
            options={PROVIDERS.map((p) => ({ value: p.id, label: `${p.label} (${p.vendor})` }))}
          />
        </Field>

        <Field label="Modell">
          <Select
            value={block.model}
            onChange={(e) => setField('model')(e.target.value)}
            options={provider.models.map((m) => ({ value: m.id, label: m.label }))}
          />
        </Field>

        <Field label="Ziel-Zeilen">
          <Select
            value={String(block.targetLines)}
            onChange={(e) => setField('targetLines')(Number(e.target.value))}
            options={[2, 3, 4, 5, 6, 8].map((n) => ({ value: String(n), label: `${n} Zeilen` }))}
          />
        </Field>
      </div>

      <StrategySelector block={block} />

      <div className="block__section">
        <Field
          label="Block-Prompt"
          hint="Spezifische Anweisung nur für diesen Block — wird unter Grundidee, Story-Pfad und Strategien gehängt."
        >
          <TextArea
            rows={3}
            value={block.prompt}
            onChange={(e) => setField('prompt')(e.target.value)}
            placeholder="z. B. Perspektivwechsel auf die zweite Person, Präsens, harte Konsonanten am Zeilenende."
          />
        </Field>

        <div className="btn-row" style={{ marginTop: 12 }}>
          <span className={`tag ${context.length ? 'tag--on' : ''}`}>
            Kontext: {context.length ? context.map((c) => c.label).join(' + ') : 'keine gelockten Blöcke'}
          </span>
          <span className="block__spacer" />
          <Button variant="ghost" onClick={() => dispatch({ type: 'INSPECT_BLOCK', blockId: block.id })}>
            {inspecting ? 'Prompt verbergen' : 'Prompt prüfen'}
          </Button>
          <Button
            variant="primary"
            disabled={!readiness.ok || busy}
            title={readiness.ok ? undefined : readiness.problems.join(' / ')}
            onClick={() => onGenerate('full')}
          >
            {busy ? 'Läuft …' : `Block generieren (${provider.label})`}
          </Button>
          {busy ? (
            <Button variant="danger" onClick={onAbort}>
              Abbrechen
            </Button>
          ) : null}
        </div>

        <div className="btn-row" style={{ marginTop: 8 }}>
          <Button
            disabled={!readiness.ok || busy}
            title="Beide Modelle schreiben denselben Block, Ergebnisse stehen nebeneinander"
            onClick={onDuel}
          >
            ⚔ Varianten-Duell
          </Button>
          <Button
            disabled={busy || !hasLines}
            title="Das jeweils andere Modell prüft den Text gegen die aktiven Strategien"
            onClick={onCritique}
          >
            ⚑ Kreuz-Kritik
          </Button>
          <Button variant="ghost" disabled={block.history.length === 0} onClick={() => setShowHistory((v) => !v)}>
            Verlauf ({block.history.length})
          </Button>
        </div>
        {!readiness.ok ? (
          <p className="field__hint" style={{ marginTop: 6, color: 'var(--warn)' }}>
            Gesperrt: {readiness.problems.join(' · ')}
          </p>
        ) : null}
      </div>

      {block.notice ? <div className="block__section notice">{block.notice}</div> : null}

      {block.stream ? (
        <div className="block__section">
          <h4 className="block__section-title">Live-Ausgabe</h4>
          <pre className="stream">{block.stream}</pre>
        </div>
      ) : null}

      {inspecting ? (
        <div className="preview">
          <pre className="preview__body">
            {renderRequestForPreview(buildRequest(state, block, 'full'))}
          </pre>
        </div>
      ) : null}

      <div className="block__section">
        <Field label="Ergebnis (Volltext)" hint="Direkt editierbar. Zeilen-Locks bleiben an der Zeilenposition hängen.">
          <TextArea
            rows={Math.max(4, block.lines.length + 1)}
            value={blockText(block)}
            onChange={(e) => dispatch({ type: 'SET_BLOCK_TEXT', blockId: block.id, value: e.target.value })}
            placeholder="Noch kein Text generiert."
          />
        </Field>
      </div>

      <LineEditor block={block} busy={busy} onGenerateLines={() => onGenerate('lines')} />

      <VariantDuel block={block} />
      <CritiquePanel block={block} />
      {showHistory ? <HistoryPanel block={block} onClose={() => setShowHistory(false)} /> : null}

      {block.error ? <div className="error-bar">{block.error}</div> : null}
    </article>
  );
}
