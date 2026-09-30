import React from 'react';
import { Button } from './ui/Controls.jsx';
import { useDispatch } from '../state/SongContext.jsx';
import { PROVIDER_BY_ID } from '../domain/providers.js';
import { syllablesInLine } from '../services/syllables.js';

/**
 * Varianten-Duell: derselbe Block von beiden Modellen, nebeneinander.
 * Übernommen wird ganz oder zeilenweise - der Vergleich ist der eigentliche
 * Zweck der App, deshalb landet nichts automatisch im Block.
 */
export default function VariantDuel({ block }) {
  const dispatch = useDispatch();
  if (block.variants.length === 0) return null;

  return (
    <div className="block__section">
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <h4 className="block__section-title" style={{ margin: 0 }}>
          Varianten-Duell
        </h4>
        <span className="block__spacer" />
        <Button variant="ghost" onClick={() => dispatch({ type: 'CLEAR_VARIANTS', blockId: block.id })}>
          Verwerfen
        </Button>
      </div>

      <div className="duel">
        {block.variants.map((variant) => (
          <div key={variant.id} className="duel__column">
            <div className="duel__head">
              <span className="duel__provider">{PROVIDER_BY_ID[variant.provider].label}</span>
              <span className="duel__model">{variant.model}</span>
              <span className="block__spacer" />
              <Button
                variant="primary"
                onClick={() => dispatch({ type: 'ADOPT_VARIANT', blockId: block.id, variantId: variant.id })}
              >
                Ganz übernehmen
              </Button>
            </div>
            <ol className="duel__lines">
              {variant.lines.map((text, i) => {
                const target = block.lines[i];
                return (
                  <li key={i} className="duel__line">
                    <span className="duel__number">{i + 1}</span>
                    <span className="duel__text">{text}</span>
                    <span className="duel__syllables">{syllablesInLine(text)}</span>
                    <button
                      type="button"
                      className="duel__adopt"
                      disabled={target?.locked}
                      title={target?.locked ? 'Zielzeile ist gelockt' : 'Nur diese Zeile übernehmen'}
                      onClick={() =>
                        dispatch({
                          type: 'ADOPT_VARIANT_LINE',
                          blockId: block.id,
                          variantId: variant.id,
                          lineIndex: i
                        })
                      }
                    >
                      ←
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
