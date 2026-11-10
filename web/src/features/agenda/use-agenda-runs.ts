import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { JobRun } from '../../lib/types';

type RunState = { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string; stale: boolean };

export function useAgendaRuns(enabled: boolean) {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [state, setState] = useState<RunState>({ status: 'idle', stale: false });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setState((previous) => ({ status: 'loading', stale: previous.status === 'ready' || previous.stale }));
    try {
      const result = await api.getAllJobRuns(100);
      if (generation.current !== current) return;
      setRuns(result);
      setState({ status: 'ready', stale: false });
    } catch (error: unknown) {
      if (generation.current !== current) return;
      setState((previous) => ({ status: 'error', stale: previous.stale, error: error instanceof Error ? error.message : 'Falha de conexão' }));
    }
  }, []);
  useEffect(() => {
    if (enabled) void refresh();
    return () => { generation.current += 1; };
  }, [enabled, refresh]);
  return { runs, state, refresh };
}
