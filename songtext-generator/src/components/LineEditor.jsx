import React from 'react';
import { Button } from './ui/Controls.jsx';
import { useDispatch } from '../state/SongContext.jsx';
import { lineState } from '../state/selectors.js';
import { meterProfile } from '../services/syllables.js';

/**
 * Zeilenbasierter Micro-Editor (Anforderung 5). Jede Zeile ist einzeln
 * lockbar; gelockte Zeilen gehen wörtlich in den Prompt, freie Zeilen werden
 * gezielt nachgeneriert.
 */
export default function LineEditor({ block, onGenerateLines, busy }) {
  const dispatch = useDispatch();
  const { locked, free, total } = lineState(block);
  const canPatch = locked.length > 0 && free.length > 0;
  const { counts, target, min, max } = meterProfile(block);

  return (
    <div className="block__section">
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <h4 className="block__section-title" style={{ margin: 0 }}>
          Zeilen-Editor
        </h4>
        <span className="block__spacer" />
        <span className="tag">{total} Zeilen</span>
        <span className={`tag ${locked.length ? 'tag--on' : ''}`}>{locked.length} gelockt</span>
        <span className="tag">{free.length} frei</span>
        {target !== null ? (
          <span className="tag tag--on" title="Aus den gelockten Zeilen abgeleitet, geht so in den Prompt">
            Maß: {min === max ? target : `${min}\u2013${max}`} Silben
          </span>
        ) : null}
      </div>

      {total === 0 ? (
        <p className="field__hint">
          Noch keine Zeilen. Block generieren oder Zeilen manuell anlegen.
        </p>
      ) : (
        <div className="lines">
          {block.lines.map((line, i) => {
            const number = i + 1;
            const power =
              number === 1 ? 'SETUP' : number === total && total > 1 ? 'PUNCHLINE' : '';
            const syllables = counts[i];
            // Mehr als eine Silbe daneben bricht den Gesang - das wird markiert.
            const offMeter =
              target !== null && line.text.trim() !== '' && Math.abs(syllables - target) > 1;
            return (
              <div key={line.id} className={`line ${line.locked ? 'line--locked' : ''}`}>
                <span className="line__number">{number}</span>
                <button
                  type="button"
                  className="line__lock"
                  title={line.locked ? 'Zeile freigeben' : 'Zeile locken'}
                  onClick={() => dispatch({ type: 'TOGGLE_LINE_LOCK', blockId: block.id, lineId: line.id })}
                >
                  {line.locked ? '■' : '□'}
                </button>
                <input
                  className="line__input"
                  value={line.text}
                  readOnly={line.locked}
                  placeholder={`Zeile ${number}`}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_LINE_TEXT',
                      blockId: block.id,
                      lineId: line.id,
                      value: e.target.value
                    })
                  }
                />
                <span className="line__tail">
                  <span
                    className={`line__syllables ${offMeter ? 'line__syllables--off' : ''}`}
                    title={
                      target === null
                        ? `${syllables} Silben (geschätzt)`
                        : `${syllables} Silben, Ziel ${target} (geschätzt)`
                    }
                  >
                    {syllables}
                  </span>
                  {power ? <span className="line__power">{power}</span> : null}
                  <button
                    type="button"
                    className="line__remove"
                    title="Zeile entfernen"
                    onClick={() => dispatch({ type: 'REMOVE_LINE', blockId: block.id, lineId: line.id })}
                  >
                    ×
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 10 }}>
        <Button variant="ghost" onClick={() => dispatch({ type: 'ADD_LINE', blockId: block.id })}>
          + Zeile
        </Button>
        <Button
          variant="ghost"
          disabled={total === 0}
          onClick={() => dispatch({ type: 'SET_ALL_LINE_LOCKS', blockId: block.id, value: true })}
        >
          Alle locken
        </Button>
        <Button
          variant="ghost"
          disabled={locked.length === 0}
          onClick={() => dispatch({ type: 'SET_ALL_LINE_LOCKS', blockId: block.id, value: false })}
        >
          Alle freigeben
        </Button>
        <span className="block__spacer" />
        <Button variant="primary" disabled={!canPatch || busy} onClick={onGenerateLines}>
          {busy ? 'Läuft …' : `Freie Zeilen generieren (${free.map((l) => l.number).join(', ') || '—'})`}
        </Button>
      </div>
      {!canPatch && total > 0 ? (
        <p className="field__hint" style={{ marginTop: 6 }}>
          Micro-Edit braucht mindestens eine gelockte und eine freie Zeile.
        </p>
      ) : null}
    </div>
  );
}
