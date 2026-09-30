import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { songReducer } from './songReducer.js';
import { loadKeys, loadSong, saveKeys, saveSong } from './persistence.js';

const SongStateContext = createContext(null);
const SongDispatchContext = createContext(null);
const KeysContext = createContext(null);

export function SongProvider({ children }) {
  const [state, dispatch] = useReducer(songReducer, null, loadSong);
  const [keys, setKeys] = useState(loadKeys);

  useEffect(() => {
    saveSong(state);
  }, [state]);

  useEffect(() => {
    saveKeys(keys);
  }, [keys]);

  const keysApi = useMemo(
    () => ({
      keys,
      setKey: (field, value) => setKeys((prev) => ({ ...prev, [field]: value })),
      clearKeys: () => setKeys({ anthropic: '', google: '' })
    }),
    [keys]
  );

  return (
    <SongStateContext.Provider value={state}>
      <SongDispatchContext.Provider value={dispatch}>
        <KeysContext.Provider value={keysApi}>{children}</KeysContext.Provider>
      </SongDispatchContext.Provider>
    </SongStateContext.Provider>
  );
}

export function useSong() {
  const ctx = useContext(SongStateContext);
  if (!ctx) throw new Error('useSong muss innerhalb von <SongProvider> genutzt werden');
  return ctx;
}

export function useDispatch() {
  const ctx = useContext(SongDispatchContext);
  if (!ctx) throw new Error('useDispatch muss innerhalb von <SongProvider> genutzt werden');
  return ctx;
}

export function useKeys() {
  const ctx = useContext(KeysContext);
  if (!ctx) throw new Error('useKeys muss innerhalb von <SongProvider> genutzt werden');
  return ctx;
}
