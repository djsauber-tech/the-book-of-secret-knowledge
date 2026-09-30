import React from 'react';
import { Button } from './ui/Controls.jsx';
import { useDispatch } from '../state/SongContext.jsx';
import { textFromLines } from '../state/songReducer.js';

const timeFormat = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

/**
 * Änderungsverlauf eines Blocks. Jeder Modell-Lauf legt vorher einen
 * Schnappschuss ab, Wiederherstellen ist ein normaler Zustandswechsel - und
 * wird selbst wieder als Schnappschuss abgelegt.
 */
export default function HistoryPanel({ block, onClose }) {
  const dispatch = useDispatch();

  return (
    <div className="block__section">
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <h4 className="block__section-title" style={{ margin: 0 }}>
          Verlauf
        </h4>
        <span className="tag">{block.history.length} Einträge</span>
        <span className="block__spacer" />
        <Button
          variant="ghost"
          disabled={block.history.length === 0}
          onClick={() => dispatch({ type: 'CLEAR_HISTORY', blockId: block.id })}
        >
          Leeren
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Schließen
        </Button>
      </div>

      {block.history.length === 0 ? (
        <p className="field__hint">Noch keine Modell-Läufe für diesen Block.</p>
      ) : (
        <ul className="history">
          {block.history.map((entry) => (
            <li key={entry.id} className="history__item">
              <div className="history__meta">
                <span className="tag">{timeFormat.format(entry.at)}</span>
                <span className="tag">{entry.kind}</span>
                <span className="block__spacer" />
                <Button
                  variant="ghost"
                  onClick={() =>
                    dispatch({ type: 'RESTORE_HISTORY', blockId: block.id, entryId: entry.id })
                  }
                >
                  Wiederherstellen
                </Button>
              </div>
              <pre className="history__text">{textFromLines(entry.lines) || '(leer)'}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
