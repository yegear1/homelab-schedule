<script lang="ts">
  import type { Contact, JobListItem, JobRun } from '../lib/types';
  import { formatDate, relativeTime, type ReadState } from '../lib/jobs/agenda';
  import JobSummary from './jobs/JobSummary.svelte';
  import JobAttempt from './jobs/JobAttempt.svelte';
  import JobActions from './jobs/JobActions.svelte';
  import Button from './ui/Button.svelte';
  type Props = { jobs: ReadState<JobListItem[]>; runs: ReadState<JobRun[]>; contacts: Contact[]; selectedId: string | null; oninspect: (id: string) => void; onchange: () => Promise<void>; onRefreshRuns: () => Promise<void> };
  let { jobs, runs, contacts, selectedId, oninspect, onchange, onRefreshRuns }: Props = $props();
  let timelineFilter = $state<'all' | 'future' | 'history'>('all');
  const futureJobs = $derived(jobs.status === 'ready' ? jobs.data.filter(job => job.status !== 'done').sort((a, b) => _time(a) - _time(b)) : []);
  const pastRuns = $derived(runs.status === 'ready' ? [...runs.data].sort((a, b) => new Date(b.ran_at).getTime() - new Date(a.ran_at).getTime()) : []);
  function _time(job: JobListItem): number { return job.next_run_at || job.run_at ? new Date(job.next_run_at || job.run_at || '').getTime() : Infinity; }
</script>
<div id="job-timeline-view" class="grid gap-6">
  <div class="flex flex-wrap gap-2" role="group" aria-label="Conteúdo da linha do tempo">
    <Button id="timeline-filter-all" aria-pressed={timelineFilter === 'all'} onclick={() => (timelineFilter = 'all')}>Todos</Button>
    <Button id="timeline-filter-future" aria-pressed={timelineFilter === 'future'} onclick={() => (timelineFilter = 'future')}>Próximos</Button>
    <Button id="timeline-filter-history" aria-pressed={timelineFilter === 'history'} onclick={() => (timelineFilter = 'history')}>Histórico</Button>
  </div>
  <p class="ui-hint">Agendamentos da lista filtrada, ordenados por próxima execução. Histórico global: até 100 tentativas retidas, sem os filtros da agenda. Enfileiramento não confirma entrega.</p>
  {#if timelineFilter !== 'history'}
    <section id="timeline-future-section" class="grid gap-4" data-state={jobs.status === 'ready' && !futureJobs.length ? 'empty' : jobs.status}>
      <h3 class="font-semibold">Agendamentos carregados</h3>
      {#if jobs.status === 'loading'}<p role="status">Carregando agendamentos…</p>
      {:else if jobs.status === 'error'}<p role="alert" class="text-error">{jobs.error}</p>
      {:else if !futureJobs.length}<p class="ui-hint">Nenhum agendamento pendente nos dados carregados.</p>
      {:else}{#each futureJobs as job (job.id)}
        <article id="timeline-job-{job.id}" class="timeline-card" aria-current={selectedId === job.id ? 'true' : undefined}>
          <p class="tabular-nums">{formatDate(job.next_run_at || job.run_at)} · {relativeTime(job.next_run_at || job.run_at)}</p>
          <JobSummary {job} {contacts} {oninspect} />
          <details><summary>Ações do recado</summary><JobActions {job} {onchange} anchors={false} compact /></details>
        </article>
      {/each}{/if}
    </section>
  {/if}
  {#if timelineFilter !== 'future'}
    <section id="timeline-history-section" class="grid gap-4" data-state={runs.status === 'ready' && !pastRuns.length ? 'empty' : runs.status}>
      <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">Histórico de disparos</h3><Button id="btn-timeline-refresh-runs" disabled={runs.status === 'loading'} onclick={onRefreshRuns}>Atualizar execuções</Button></div>
      {#if runs.status === 'loading'}<p role="status">Carregando histórico…</p>
      {:else if runs.status === 'error'}<p role="alert" class="text-error">{runs.error}</p>
      {:else if !pastRuns.length}<p class="ui-hint">Nenhuma tentativa retida encontrada.</p>
      {:else}{#each pastRuns as run (run.id)}<div id="timeline-run-{run.id}"><JobAttempt {run} title={jobs.status === 'ready' ? jobs.data.find(job => job.id === run.job_id)?.title : undefined} selected={selectedId === run.job_id} {oninspect} /></div>{/each}{/if}
    </section>
  {/if}
</div>
<style>
  .timeline-card { display: grid; gap: 12px; padding: 16px; border: 1px solid rgb(var(--separator)); border-left: 3px solid rgb(var(--accent)); border-radius: 12px; }
  .timeline-card[aria-current='true'] { background: rgb(var(--accent) / .08); }
  summary { cursor: pointer; min-height: 44px; padding: 8px; color: rgb(var(--accent)); border-radius: 8px; }
  summary:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 2px; }
</style>
