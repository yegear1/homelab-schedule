import { useMemo, useState } from 'react';
import type { Job } from '../../types/domain';
import type { JobRun } from '../../lib/types';
import { ResourceNotice } from '../../components/ResourceNotice';
import { useJobsStore } from '../../stores/jobs';
import { QUEUED_NOT_DELIVERED, runWithFeedback } from '../../lib/jobs/mutations';

type RunState = { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string; stale: boolean };
interface JobsTimelineProps {
  jobs: Job[];
  runs: JobRun[];
  runState: RunState;
  refreshRuns: () => void;
  onInspect: (jobId: string) => void;
}

export function JobsTimeline({ jobs, runs, runState, refreshRuns, onInspect }: JobsTimelineProps) {
  const [tab, setTab] = useState<'all' | 'future' | 'history'>('all');
  const runJobNow = useJobsStore((state) => state.runJobNow);
  const upcoming = useMemo(() => jobs.filter((job) =>
    (job.status === 'scheduled' || job.status === 'snoozed') && job.next_run_at
  ).sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime()), [jobs]);
  const history = useMemo(() => [...runs].sort((a, b) => new Date(b.ran_at).getTime() - new Date(a.ran_at).getTime()), [runs]);
  return (
    <div id="job-timeline-view" className="rounded-xl border border-border bg-card p-4 md:p-6 space-y-4">
      <h2 className="font-semibold">Linha do tempo</h2>
      <p className="text-xs text-muted-foreground">Próximas execuções dos até 50 agendamentos carregados; até 100 tentativas globais retidas.</p>
      <div className="flex flex-wrap gap-2">
        {(['all', 'future', 'history'] as const).map((value) => <button key={value} type="button" id={`timeline-filter-${value}`} aria-pressed={tab === value} onClick={() => setTab(value)} className="min-h-[44px] px-3 rounded border border-border">{value === 'all' ? 'Todos' : value === 'future' ? 'Próximos' : 'Histórico'}</button>)}
        <button type="button" id="btn-timeline-refresh-runs" onClick={refreshRuns} className="min-h-[44px] px-3 rounded border border-border">Atualizar tentativas</button>
      </div>
      {tab !== 'history' && <section id="timeline-future-section" className="space-y-2">
        <h3 className="font-semibold">Próximas execuções</h3>
        {upcoming.length === 0 && <p>Nenhuma próxima execução carregada.</p>}
        {upcoming.map((job) => <article key={job.id} className="rounded border border-border p-3 space-y-1">
          <button type="button" className="underline text-left" onClick={() => onInspect(job.id)}>{job.title}</button>
          <p className="text-sm">{new Date(job.next_run_at!).toLocaleString()} · {job.recipient}</p>
          <button type="button" className="min-h-[44px] underline" onClick={() => void runWithFeedback({ id: `timeline-run-${job.id}`, success: `Queued ${job.title}`, description: QUEUED_NOT_DELIVERED, failure: `Dispatch failed for ${job.title}`, action: () => runJobNow(job.id) })}>Run Now</button>
        </article>)}
      </section>}
      {tab !== 'future' && <section id="timeline-history-section" className="space-y-2">
        <h3 className="font-semibold">Tentativas globais</h3>
        <ResourceNotice label="tentativas" {...runState} onRetry={refreshRuns} />
        {(runState.status === 'ready' || runState.stale) && <>
          {history.length === 0 && <p>Nenhuma tentativa carregada.</p>}
          {history.map((run) => {
            const job = jobs.find((item) => item.id === run.job_id);
            return <article key={run.id} className="rounded border border-border p-3">
              {job ? <button type="button" className="underline" onClick={() => onInspect(job.id)}>{job.title}</button> : <span>Agendamento {run.job_id}</span>}
              <p className="text-sm">{new Date(run.ran_at).toLocaleString()} · {run.status} · HTTP {run.status_code ?? '—'} · {run.duration_ms ?? '—'} ms</p>
              {run.error_message && <p className="text-sm text-rose-500">{run.error_message}</p>}
            </article>;
          })}
        </>}
      </section>}
    </div>
  );
}
