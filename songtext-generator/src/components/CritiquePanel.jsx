import React from 'react';
import { Button } from './ui/Controls.jsx';
import { useDispatch } from '../state/SongContext.jsx';
import { PROVIDER_BY_ID } from '../domain/providers.js';

/**
 * Kreuz-Kritik: Befunde des jeweils anderen Modells, einzeln annehmbar oder
 * verwerfbar. Zeilenbezogene Vorschläge schreiben direkt in die Zeile.
 */
export default function CritiquePanel({ block }) {
  const dispatch = useDispatch();
  const critique = block.critique;
  if (!critique) return null;

  const reviewerLabel = critique.reviewer
    ? `${PROVIDER_BY_ID[critique.reviewer.provider].label} (${critique.reviewer.model})`
    : '—';

  return (
    <div className="block__section">
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <h4 className="block__section-title" style={{ margin: 0 }}>
          Kreuz-Kritik
        </h4>
        <span className="tag">Prüfer: {reviewerLabel}</span>
        {critique.reviewer && !critique.reviewer.isCross ? (
          <span className="tag tag--warn">Selbstkritik — zweiter Key fehlt</span>
        ) : null}
        <span className="block__spacer" />
        <Button variant="ghost" onClick={() => dispatch({ type: 'CLEAR_CRITIQUE', blockId: block.id })}>
          Schließen
        </Button>
      </div>

      {critique.status === 'running' ? <p className="field__hint">Prüfung läuft …</p> : null}
      {critique.status === 'error' ? <div className="error-bar">{critique.error}</div> : null}

      {critique.status === 'done' && critique.findings.length === 0 ? (
        <p className="notice">Keine Befunde — der Prüfer hat nichts zu beanstanden.</p>
      ) : null}

      {critique.findings.length > 0 ? (
        <ul className="findings">
          {critique.findings.map((finding) => (
            <li key={finding.id} className={`finding finding--${finding.severity}`}>
              <div className="finding__head">
                <span className={`tag ${finding.severity === 'hart' ? 'tag--alarm' : 'tag--warn'}`}>
                  {finding.severity}
                </span>
                {finding.line ? <span className="tag">Zeile {finding.line}</span> : <span className="tag">Block</span>}
                {finding.strategy ? <span className="tag tag--on">{finding.strategy}</span> : null}
                {finding.applied ? <span className="tag tag--on">übernommen</span> : null}
              </div>
              <p className="finding__problem">{finding.problem}</p>
              {finding.suggestion ? (
                <p className="finding__suggestion">→ {finding.suggestion}</p>
              ) : null}
              <div className="btn-row">
                {finding.suggestion && finding.line ? (
                  <Button
                    variant="primary"
                    disabled={finding.applied || block.lines[finding.line - 1]?.locked}
                    title={
                      block.lines[finding.line - 1]?.locked ? 'Zeile ist gelockt' : 'Vorschlag einsetzen'
                    }
                    onClick={() =>
                      dispatch({ type: 'APPLY_FINDING', blockId: block.id, findingId: finding.id })
                    }
                  >
                    Übernehmen
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  onClick={() =>
                    dispatch({ type: 'DISMISS_FINDING', blockId: block.id, findingId: finding.id })
                  }
                >
                  Verwerfen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
