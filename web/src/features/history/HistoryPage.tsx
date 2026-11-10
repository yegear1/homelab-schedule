import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '../../lib/api';
import type { JobRun } from '../../lib/types';
import { JobInspector } from '../agenda/wdg-job-inspector';

type Filter = 'all' | 'success' | 'error';
type Query = { status: Filter; limit: number };
type ReadState = { status: 'loading' | 'ready' | 'error'; error?: string };

export function HistoryPage() {
  const [query, setQuery] = useState<Query>({ status: 'all', limit: 50 });
  const [applied, setApplied] = useState<Query | null>(null);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [state, setState] = useState<ReadState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<JobRun | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setState({ status: 'loading' });
    void api.getAllJobRuns(query.limit, query.status === 'all' ? undefined : query.status).then((data) => {
      if (current !== generation.current) return;
      setRuns([...data].sort((a, b) => new Date(b.ran_at).getTime() - new Date(a.ran_at).getTime()));
      setApplied(query);
      setState({ status: 'ready' });
    }).catch((error: unknown) => {
      if (current === generation.current) setState({ status: 'error', error: error instanceof Error ? error.message : 'falha de conexão' });
    });
    return () => { generation.current += 1; };
  }, [query, revision]);
  const exportCsv = useCallback(async () => {
    if (!applied || state.status !== 'ready' || exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (applied.status !== 'all') params.set('status', applied.status);
      const blob = await api.downloadCsv('/jobs/runs/export.csv', params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'historico.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast.error(`Falha ao exportar CSV: ${error instanceof Error ? error.message : 'falha de conexão'}`);
    } finally { setExporting(false); }
  }, [applied, state.status, exporting]);
  return <div className="max-w-7xl mx-auto space-y-4">
    <h1 className="text-xl font-bold">Histórico de execuções</h1>
    <p className="text-sm text-muted-foreground">Tentativas retidas, limitadas à consulta; aceitação pelo gateway não confirma entrega.</p>
    <div className="flex flex-wrap gap-2 items-center">
      <label>Status <select aria-label="Status do histórico" value={query.status} onChange={(event) => setQuery({ ...query, status: event.target.value as Filter })} className="border rounded p-2 bg-background">
        <option value="all">Todos</option><option value="success">Sucesso</option><option value="error">Erro</option>
      </select></label>
      <label>Limite <select aria-label="Limite do histórico" value={query.limit} onChange={(event) => setQuery({ ...query, limit: Number(event.target.value) })} className="border rounded p-2 bg-background"><option value={50}>50</option><option value={100}>100</option></select></label>
      <button type="button" onClick={() => setRevision((n) => n + 1)} className="border rounded p-2 min-h-[44px]">Atualizar</button>
      <button type="button" onClick={() => void exportCsv()} disabled={state.status !== 'ready' || exporting} className="border rounded p-2 min-h-[44px]">Exportar CSV</button>
    </div>
    {state.status === 'loading' && <p role="status">Carregando histórico…</p>}
    {state.status === 'error' && <div role="alert">Falha ao carregar histórico: {state.error} <button type="button" onClick={() => setRevision((n) => n + 1)}>Tentar novamente</button></div>}
    {state.status === 'ready' && <section>
      <p className="text-sm">{runs.length} tentativas carregadas · limite {applied?.limit}</p>
      {runs.length === 0 ? <p>Nenhuma tentativa encontrada.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>Data</th><th>Agendamento</th><th>Origem</th><th>Status</th><th>HTTP</th><th>Duração</th><th>Ações</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t border-border">
        <td>{run.ran_at}</td><td><button type="button" className="underline" onClick={() => setJobId(run.job_id)}>{run.job_id}</button></td><td>{run.trigger}</td><td>{run.status}</td><td>{run.status_code ?? '—'}</td><td>{run.duration_ms ?? '—'} ms</td><td><button type="button" onClick={() => setSelected(run)} className="underline min-h-[44px]">Detalhes</button></td>
      </tr>)}</tbody></table></div>}
    </section>}
    <Dialog.Root open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}><Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
      {selected && <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card p-6 rounded border border-border space-y-2 max-w-lg w-full">
        <Dialog.Title className="font-semibold">Tentativa {selected.id}</Dialog.Title><p>{selected.ran_at} · {selected.trigger} · {selected.status}</p><p>HTTP {selected.status_code ?? '—'} · {selected.duration_ms ?? '—'} ms</p>{selected.error_message && <p>{selected.error_message}</p>}
        <button type="button" className="underline mr-4 min-h-[44px]" onClick={() => { setJobId(selected.job_id); setSelected(null); }}>Inspecionar agendamento</button><Dialog.Close>Fechar</Dialog.Close>
      </Dialog.Content>}
    </Dialog.Portal></Dialog.Root>
    <JobInspector job={null} jobId={jobId} open={!!jobId} onOpenChange={(open) => { if (!open) setJobId(null); }} />
  </div>;
}
