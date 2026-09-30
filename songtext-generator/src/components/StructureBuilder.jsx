import React, { useCallback, useRef, useState } from 'react';
import SongBlock from './SongBlock.jsx';
import { Button } from './ui/Controls.jsx';
import { useDispatch, useKeys, useSong } from '../state/SongContext.jsx';
import { BLOCK_TYPES } from '../domain/blockTypes.js';
import { generateBlock, generateVariants } from '../services/generation.js';
import { critiqueBlock, reviewerFor } from '../services/critique.js';
import { AbortedError } from '../services/providers/index.js';
import { formatFailure } from '../services/diagnostics.js';

/**
 * Modularer Struktur-Builder (Anforderung 3) und einziger Ort, an dem Läufe
 * gestartet werden - die Blöcke selbst bleiben rein darstellend.
 */
export default function StructureBuilder() {
  const state = useSong();
  const dispatch = useDispatch();
  const { keys } = useKeys();
  const [runningIds, setRunningIds] = useState([]);
  // Ein Controller je Block: laufende Aufrufe bleiben abbrechbar, auch wenn
  // mehrere Blöcke parallel arbeiten.
  const controllers = useRef(new Map());

  const finish = useCallback((blockId) => {
    controllers.current.delete(blockId);
    setRunningIds((ids) => ids.filter((id) => id !== blockId));
  }, []);

  const start = useCallback(
    (blockId) => {
      const controller = new AbortController();
      controllers.current.set(blockId, controller);
      setRunningIds((ids) => [...ids, blockId]);
      return controller.signal;
    },
    []
  );

  const abort = useCallback((blockId) => {
    controllers.current.get(blockId)?.abort();
  }, []);

  /** Gemeinsame Fehlerbehandlung: Abbruch ist kein Fehler. */
  const handleFailure = useCallback(
    (blockId, error, failedAction) => {
      if (error instanceof AbortedError || error?.name === 'AbortError') {
        dispatch({ type: 'GENERATION_ABORTED', blockId });
        return;
      }
      dispatch({ ...failedAction, blockId, error: formatFailure(error) });
    },
    [dispatch]
  );

  const notice = useCallback(
    (blockId) =>
      ({ attempt, delayMs, reason }) =>
        dispatch({
          type: 'GENERATION_NOTICE',
          blockId,
          notice: `${reason} — Versuch ${attempt + 1} in ${Math.round(delayMs / 100) / 10}s`
        }),
    [dispatch]
  );

  const runGenerate = useCallback(
    async (block, mode) => {
      const signal = start(block.id);
      dispatch({ type: 'GENERATION_START', blockId: block.id });
      try {
        const action = await generateBlock({
          state,
          block,
          mode,
          keys,
          signal,
          onDelta: (text) => dispatch({ type: 'GENERATION_DELTA', blockId: block.id, text }),
          onRetry: notice(block.id)
        });
        dispatch(action);
      } catch (error) {
        handleFailure(block.id, error, { type: 'GENERATION_FAILED' });
      } finally {
        finish(block.id);
      }
    },
    [state, keys, dispatch, start, finish, notice, handleFailure]
  );

  const runDuel = useCallback(
    async (block) => {
      const signal = start(block.id);
      dispatch({ type: 'GENERATION_START', blockId: block.id });
      try {
        const { variants, failures } = await generateVariants({
          state,
          block,
          keys,
          signal,
          onRetry: notice(block.id)
        });
        dispatch({ type: 'VARIANTS_RECEIVED', blockId: block.id, variants, failures });
      } catch (error) {
        handleFailure(block.id, error, { type: 'GENERATION_FAILED' });
      } finally {
        finish(block.id);
      }
    },
    [state, keys, dispatch, start, finish, notice, handleFailure]
  );

  const runCritique = useCallback(
    async (block) => {
      const reviewer = reviewerFor(block, keys);
      if (!reviewer) {
        dispatch({
          type: 'CRITIQUE_FAILED',
          blockId: block.id,
          reviewer: null,
          error: 'Kein API-Key hinterlegt'
        });
        return;
      }
      const signal = start(block.id);
      dispatch({ type: 'CRITIQUE_START', blockId: block.id, reviewer });
      try {
        const { findings } = await critiqueBlock({
          state,
          block,
          reviewer,
          keys,
          signal,
          onRetry: notice(block.id)
        });
        dispatch({ type: 'CRITIQUE_RECEIVED', blockId: block.id, findings, reviewer });
      } catch (error) {
        if (error instanceof AbortedError || error?.name === 'AbortError') {
          dispatch({ type: 'CLEAR_CRITIQUE', blockId: block.id });
        } else {
          dispatch({ type: 'CRITIQUE_FAILED', blockId: block.id, reviewer, error: formatFailure(error) });
        }
      } finally {
        finish(block.id);
      }
    },
    [state, keys, dispatch, start, finish, notice]
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
          onGenerate={(mode) => runGenerate(block, mode)}
          onDuel={() => runDuel(block)}
          onCritique={() => runCritique(block)}
          onAbort={() => abort(block.id)}
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
