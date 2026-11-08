<script lang="ts">
  import type { Contact, JobListItem, JobRun } from '../lib/types';
  import { calendarEvents, dateKey, formatDate, type ReadState } from '../lib/jobs/agenda';
  import Button from './ui/Button.svelte';
  import JobSummary from './jobs/JobSummary.svelte';
  import JobActions from './jobs/JobActions.svelte';
  import JobAttempt from './jobs/JobAttempt.svelte';
  type Props = { jobs: ReadState<JobListItem[]>; runs: ReadState<JobRun[]>; contacts: Contact[]; selectedId: string | null; oninspect: (id: string) => void; onchange: () => Promise<void>; onRefreshRuns: () => Promise<void> };
  let { jobs, runs, contacts, selectedId, oninspect, onchange, onRefreshRuns }: Props = $props();
  const now = new Date();
  let month = $state(new Date(now.getFullYear(), now.getMonth(), 1));
  let selectedDateKey = $state(dateKey(now));
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const events = $derived(calendarEvents(jobs.status === 'ready' ? jobs.data : [], runs.status === 'ready' ? runs.data : []));
  const selectedDayEvents = $derived(events.get(selectedDateKey) ?? { jobs: [], runs: [] });
  const cells = $derived.by(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = Math.ceil((first.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1);
      const key = dateKey(date);
      const day = events.get(key);
      return { date, key, scheduledCount: day?.jobs.length ?? 0, runsCount: day?.runs.length ?? 0,
        hasError: Boolean(day?.jobs.some(job => job.status === 'error') || day?.runs.some(run => run.status === 'error')) };
    });
  });
  function _moveMonth(offset: number): void { month = new Date(month.getFullYear(), month.getMonth() + offset, 1); }
  function _today(): void { const today = new Date(); month = new Date(today.getFullYear(), today.getMonth(), 1); selectedDateKey = dateKey(today); }
  function _select(date: Date): void { selectedDateKey = dateKey(date); }
  function _key(event: KeyboardEvent, date: Date): void {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -date.getDay(), End: 6 - date.getDay() };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    _select(next);
    month = new Date(next.getFullYear(), next.getMonth(), 1);
    requestAnimationFrame(() => document.getElementById(`calendar-day-${dateKey(next)}`)?.focus());
  }
</script>
<div id="job-calendar-view" class="grid gap-4">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h3 id="calendar-current-month" class="font-semibold capitalize" aria-live="polite">{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
    <div class="flex flex-wrap gap-2"><Button id="btn-calendar-prev" aria-label="Mês anterior" onclick={() => _moveMonth(-1)}>Anterior</Button><Button id="btn-calendar-today" onclick={_today}>Hoje</Button><Button id="btn-calendar-next" aria-label="Próximo mês" onclick={() => _moveMonth(1)}>Próximo</Button></div>
  </div>
  <p class="ui-hint">Somente próximas ocorrências dos agendamentos carregados e até 100 tentativas globais retidas. O calendário não expande todas as ocorrências cron.</p>
  {#if jobs.status === 'loading'}<p role="status">Carregando agendamentos…</p>{:else if jobs.status === 'error'}<p role="alert" class="text-error">Agendamentos indisponíveis: {jobs.error}</p>{/if}
  {#if runs.status === 'loading'}<p role="status">Carregando tentativas…</p>{:else if runs.status === 'error'}<p role="alert" class="text-error">Tentativas indisponíveis: {runs.error}</p><Button onclick={onRefreshRuns}>Tentar carregar tentativas</Button>{/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="calendar-scroll" role="region" aria-label="Calendário mensal" tabindex="0">
    <div class="weekdays" aria-hidden="true">{#each weekDays as day}<span>{day}</span>{/each}</div>
    <div id="calendar-grid" class="calendar-grid">
      {#each cells as cell (cell.key)}
        <button type="button" id="calendar-day-{cell.key}" data-date={cell.key} data-outside={cell.date.getMonth() !== month.getMonth()} aria-pressed={selectedDateKey === cell.key} aria-current={cell.key === dateKey(now) ? 'date' : undefined}
          aria-label="{cell.date.toLocaleDateString('pt-BR')}: {jobs.status === 'ready' ? `${cell.scheduledCount} agendamentos` : 'agendamentos indisponíveis'}, {runs.status === 'ready' ? `${cell.runsCount} tentativas` : 'tentativas indisponíveis'}{cell.hasError ? ', com erro' : ''}"
          onclick={() => _select(cell.date)} onkeydown={(event) => _key(event, cell.date)}>
          <span>{cell.date.getDate()}</span>
          {#if cell.scheduledCount}<span class="day-count" aria-hidden="true">{cell.scheduledCount} ag.</span>{/if}
          {#if cell.runsCount}<span class="day-count" aria-hidden="true">{cell.runsCount} tent.</span>{/if}
          {#if cell.hasError}<span class="day-error" aria-hidden="true">Erro</span>{/if}
        </button>
      {/each}
    </div>
  </div>
  <section id="calendar-day-detail" class="grid gap-4" aria-label="Detalhes do dia selecionado">
    <h3 class="font-semibold">{new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
    {#if jobs.status === 'ready' && runs.status === 'ready' && !selectedDayEvents.jobs.length && !selectedDayEvents.runs.length}<p class="ui-hint">Nenhum registro carregado para este dia.</p>{/if}
    {#each [...selectedDayEvents.jobs].sort((a, b) => (a.next_run_at || a.run_at || '').localeCompare(b.next_run_at || b.run_at || '')) as job (job.id)}
      <article id="calendar-event-job-{job.id}" class="day-event" aria-current={selectedId === job.id ? 'true' : undefined}><p class="tabular-nums">{formatDate(job.next_run_at || job.run_at)}</p><JobSummary {job} {contacts} {oninspect} /><details><summary>Ações do recado</summary><JobActions {job} {onchange} anchors={false} compact /></details></article>
    {/each}
    {#each [...selectedDayEvents.runs].sort((a, b) => b.ran_at.localeCompare(a.ran_at)) as run (run.id)}<div id="calendar-event-run-{run.id}"><JobAttempt {run} selected={selectedId === run.job_id} {oninspect} /></div>{/each}
  </section>
</div>
<style>
  .calendar-scroll { overflow-x: auto; max-width: 100%; }
  .weekdays, .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); min-width: 280px; }
  .weekdays span { text-align: center; font-size: 12px; padding-block: 8px; color: rgb(var(--secondary-label)); }
  .calendar-grid { gap: 1px; background: rgb(var(--separator)); border: 1px solid rgb(var(--separator)); }
  .calendar-grid button { display: flex; flex-direction: column; align-items: start; gap: 4px; padding: 8px; min-width: 0; min-height: 88px; background: rgb(var(--secondary-system-background)); font-variant-numeric: tabular-nums; }
  .calendar-grid button[data-outside='true'] { background: rgb(var(--system-background)); color: rgb(var(--secondary-label)); }
  .calendar-grid button[aria-pressed='true'] { background: rgb(var(--accent) / .12); box-shadow: inset 0 0 0 2px rgb(var(--accent)); }
  .calendar-grid button:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: -3px; }
  .day-count, .day-error { font-size: 11px; max-width: 100%; overflow: hidden; white-space: nowrap; }
  .day-error { color: rgb(var(--palette-error)); font-weight: 650; }
  .day-event { display: grid; gap: 8px; border: 1px solid rgb(var(--separator)); border-radius: 12px; padding: 16px; }
  summary { min-height: 44px; padding: 8px; cursor: pointer; color: rgb(var(--accent)); }
  summary:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 2px; }
</style>
