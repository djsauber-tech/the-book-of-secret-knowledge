import React from 'react';
import { STRATEGIES } from '../domain/strategies.js';
import { Checkbox } from './ui/Controls.jsx';
import { useDispatch } from '../state/SongContext.jsx';

/**
 * Auswahlmenü bzw. automatisierte Zuweisung der sechs Herangehensweisen.
 * "AUTO" folgt der Vorgabe je Block-Typ; jeder manuelle Klick schaltet auf
 * manuelle Auswahl um.
 */
export default function StrategySelector({ block }) {
  const dispatch = useDispatch();

  return (
    <div className="block__section">
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <h4 className="block__section-title" style={{ margin: 0 }}>
          Songwriting-Strategien
        </h4>
        <span className="block__spacer" />
        <Checkbox
          checked={block.autoStrategies}
          onChange={() => dispatch({ type: 'TOGGLE_AUTO_STRATEGIES', blockId: block.id })}
          label="Auto (nach Block-Typ)"
        />
        <span className={`tag ${block.strategies.length ? 'tag--on' : 'tag--alarm'}`}>
          {block.strategies.length}/6 aktiv
        </span>
      </div>

      <div className="strategy-grid">
        {STRATEGIES.map((strategy) => {
          const on = block.strategies.includes(strategy.id);
          return (
            <button
              key={strategy.id}
              type="button"
              className={`strategy ${on ? 'strategy--on' : ''}`}
              onClick={() =>
                dispatch({ type: 'TOGGLE_STRATEGY', blockId: block.id, strategyId: strategy.id })
              }
              title={strategy.directive}
            >
              <span className="strategy__top">
                <span className="strategy__short">{on ? '■' : '□'} {strategy.short}</span>
              </span>
              <span className="strategy__name">{strategy.name}</span>
              <span className="strategy__summary">{strategy.summary}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
