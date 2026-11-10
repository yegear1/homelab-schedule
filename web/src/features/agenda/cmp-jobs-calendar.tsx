import { useState } from 'react';
import type { Job } from '../../types/domain';
import type { JobRun } from '../../lib/types';
import { ResourceNotice } from '../../components/ResourceNotice';

type RunState = { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string; stale: boolean };
interface JobsCalendarProps {
  jobs: Job[];
  runs: JobRun[];
  runState: RunState;
  refreshRuns: () => void;
  onInspect: (jobId: string) => void;
}

function _dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function JobsCalendar({ jobs, runs, runState, refreshRuns, onInspect }: JobsCalendarProps) {
  const [selected, setSelected] = useState(() => new Date());
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const offset = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const nextJobs = jobs.filter((job) => (job.status === 'scheduled' || job.status === 'snoozed') && job.next_run_at);
  const jobsFor = (date: Date) => nextJobs.filter((job) => _dateKey(new Date(job.next_run_at!)) === _dateKey(date)).sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime());
  const runsFor = (date: Date) => runs.filter((run) => _dateKey(new Date(run.ran_at)) === _dateKey(date)).sort((a, b) => new Date(b.ran_at).getTime() - new Date(a.ran_at).getTime());
  const selectedJobs = jobsFor(selected);
  const selectedRuns = runsFor(selected);
  const moveMonth = (delta: number) => setSelected(new Date(year, month + delta, 1));
  const historyVisible = runState.status === 'ready' || runState.stale;
  return <div id="job-calendar-view" className="rounded-xl border border-border bg-card p-4 md:p-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="calendar-current-month" className="font-semibold">{selected.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
      <div className="flex gap-2">
        <button id="btn-calendar-prev" type="button" aria-label="Mês anterior" onClick={() => moveMonth(-1)} className="min-h-[44px] px-3 border rounded">‹</button>
        <button id="btn-calendar-today" type="button" onClick={() => setSelected(new Date())} className="min-h-[44px] px-3 border rounded">Hoje</button>
        <button id="btn-calendar-next" type="button" aria-label="Próximo mês" onClick={() => moveMonth(1)} className="min-h-[44px] px-3 border rounded">›</button>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Até 50 agendamentos carregados e 100 tentativas globais retidas; recorrências não são expandidas.</p>
    <ResourceNotice label="tentativas" {...runState} onRetry={refreshRuns} />
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <span key={day}>{day}</span>)}</div>
    <div id="calendar-grid" className="grid grid-cols-7 gap-1">
      {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
      {Array.from({ length: days }, (_, index) => {
        const date = new Date(year, month, index + 1);
        const dayJobs = jobsFor(date);
        const dayRuns = historyVisible ? runsFor(date) : [];
        const hasError = dayRuns.some((run) => run.status === 'error');
        return <button type="button" key={index} aria-label={date.toLocaleDateString('pt-BR')} aria-pressed={_dateKey(date) === _dateKey(selected)} onClick={() => setSelected(date)} className="min-h-[64px] rounded border border-border p-1 text-left aria-pressed:border-sky-500">
          <span>{index + 1}</span><span className="block text-xs">{dayJobs.length} ag. {historyVisible && `· ${dayRuns.length} tent.`}{hasError && ' ⚠'}</span>
        </button>;
      })}
    </div>
    <section id="calendar-day-detail" className="space-y-2 border border-border rounded p-3">
      <h3 className="font-semibold">{selected.toLocaleDateString('pt-BR', { dateStyle: 'full' })}</h3>
      <p className="text-sm">{selectedJobs.length} próximas execuções{historyVisible && ` · ${selectedRuns.length} tentativas`}</p>
      {selectedJobs.map((job) => <button key={job.id} type="button" className="block underline text-left min-h-[44px]" onClick={() => onInspect(job.id)}>{new Date(job.next_run_at!).toLocaleTimeString()} · {job.title}</button>)}
      {historyVisible && selectedRuns.map((run) => <p key={run.id} className="text-sm">{new Date(run.ran_at).toLocaleTimeString()} · {run.status} · HTTP {run.status_code ?? '—'} · {run.duration_ms ?? '—'} ms · {jobs.find((job) => job.id === run.job_id)?.title ?? run.job_id}</p>)}
    </section>
  </div>;
}
