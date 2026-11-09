import { useJobsStore } from '../../stores/jobs';

export interface KpiSummaryProps {
  onFilterErrors?: () => void;
}

export function KpiSummary({ onFilterErrors }: KpiSummaryProps) {
  const { jobs } = useJobsStore();
  const active = jobs.filter((job) => job.status === 'scheduled').length;
  const errors = jobs.filter((job) => job.status === 'error').length;
  const next = jobs
    .filter((job) => job.status === 'scheduled' && job.next_run_at)
    .map((job) => job.next_run_at as string)
    .sort()[0];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6" aria-label="Resumo dos agendamentos carregados">
      <div className="p-4 rounded-xl border border-border bg-card">
        <span className="text-xs text-muted-foreground">Agendamentos ativos carregados</span>
        <p className="text-2xl font-bold">{active}</p>
      </div>
      <button id="card-metric-errors" type="button" onClick={onFilterErrors} className="p-4 rounded-xl border border-border bg-card text-left">
        <span className="text-xs text-muted-foreground">Erros nos itens carregados</span>
        <p className="text-2xl font-bold">{errors}</p>
      </button>
      <div className="p-4 rounded-xl border border-border bg-card">
        <span className="text-xs text-muted-foreground">Próxima execução carregada</span>
        <p className="text-sm font-semibold">{next ? new Date(next).toLocaleString() : 'Nenhuma disponível'}</p>
      </div>
    </div>
  );
}
