import React, { useCallback, useState } from 'react';
import SongBlock from './SongBlock.jsx';
import { Button } from './ui/Controls.jsx';
import { useDispatch, useKeys, useSong } from '../state/SongContext.jsx';
import { BLOCK_TYPES } from '../domain/blockTypes.js';
import { generateBlock } from '../services/generation.js';

/**
 * Modularer Struktur-Builder (Anforderung 3) und einziger Ort, an dem die
 * Generierung ausgelöst wird - die Bloecke selbst bleiben rein darstellend.
 */
export default function StructureBuilder() {
  const state = useSong();
  const dispatch = useDispatch();
  const { keys } = useKeys();
  const [runningIds, setRunningIds] = useState([]);

  const run = useCallback(
    async (block, mode) => {
      setRunningIds((ids) => [...ids, block.id]);
      dispatch({ type: 'GENERATION_START', blockId: block.id });
      try {
        const action = await generateBlock({ state, block, mode, keys });
        dispatch(action);
      } catch (error) {
        dispatch({
          type: 'GENERATION_FAILED',
          blockId: block.id,
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        setRunningIds((ids) => ids.filter((id) => id !== block.id));
      }
    },
    [state, keys, dispatch]
  );

  return (
    <>
      <section className="panel">
        <header className="panel__head">
          <span>Struktur-Builder</span>
          <span className="panel__head-spacer" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
            {state.blocks.length} Blöcke · {state.blocks.filter((b) => b.locked).length} gelockt
          </span>
        </header>
      </section>

      {state.blocks.map((block) => (
        <SongBlock
          key={block.id}
          block={block}
          busy={runningIds.includes(block.id)}
          onGenerate={(mode) => run(block, mode)}
        />
      ))}

      <div className="addbar">
        <span className="addbar__label">Block hinzufügen</span>
        {BLOCK_TYPES.map((type) => (
          <Button key={type.id} onClick={() => dispatch({ type: 'ADD_BLOCK', blockType: type.id })}>
            + {type.label}
          </Button>
        ))}
      </div>
    </>
  );
}
