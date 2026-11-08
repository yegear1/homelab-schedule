<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { AgendaState } from '../lib/jobs/agenda.svelte';
  import { csvFilters, defaultFilters, parseFilters, saveCsv, type AgendaView } from '../lib/jobs/agenda';
  import JobComposer from '../components/jobs/JobComposer.svelte';
  import JobInspector from '../components/jobs/JobInspector.svelte';
  import JobFilters from '../components/jobs/JobFilters.svelte';
  import JobTable from '../components/jobs/JobTable.svelte';
  import JobTimelineView from '../components/JobTimelineView.svelte';
  import JobCalendarView from '../components/JobCalendarView.svelte';
  import Button from '../components/ui/Button.svelte';

  const agenda = new AgendaState();
  let activeView = $state<AgendaView>('table');
  let draft = $state(defaultFilters());
  let filterError = $state('');
  let selectedId = $state<string | null>(null);
  let createModalOpen = $state(false);
  let exporting = $state<'jobs' | 'runs' | null>(null);
  let csvError = $state('');
  const jobs = $derived(agenda.jobs.status === 'ready' ? agenda.jobs.data : []);
  const errorCount = $derived(jobs.filter(job => job.status === 'error').length);

  onMount(() => {
    void agenda.refresh();
    void agenda.loadCatalogs();
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) selectedId = null;
    };
    window.addEventListener('keydown', escape);
    return () => { agenda.dispose(); window.removeEventListener('keydown', escape); };
  });
  function _apply(): void {
    const result = parseFilters(draft);
    filterError = result.ok ? '' : result.error;
    if (result.ok) void agenda.loadJobs(result.query);
  }
  function _reset(): void { draft = defaultFilters(); _apply(); }
  function _errors(): void { draft.status = 'error'; _apply(); }
  function _inspect(id: string): void { selectedId = id; }
  async function _changed(): Promise<void> { await agenda.refresh(); }
  async function _download(kind: 'jobs' | 'runs'): Promise<void> {
    if (exporting) return;
    exporting = kind; csvError = '';
    try {
      const params = kind === 'jobs' ? csvFilters(agenda.applied) : new URLSearchParams();
      const blob = await api.downloadCsv(kind === 'jobs' ? '/jobs/export.csv' : '/jobs/runs/export.csv', params);
      saveCsv(blob, kind === 'jobs' ? 'agendamentos.csv' : 'historico.csv');
      toast.success('CSV exportado.');
    } catch (err) { csvError = err instanceof Error ? err.message : 'Falha ao exportar CSV.'; }
    finally { exporting = null; }
  }
</script>

<div id="scr-jobs" class="jobs-workspace" data-state={agenda.jobs.status}>
  <header class="workspace-header">
    <div><p class="ui-hint">Agendamentos e execuções</p><h1>Agenda</h1><p class="ui-hint">Organize recados e rotinas. Cada disparo é enfileirado no gateway.</p></div>
    <div class="flex flex-wrap gap-2"><Button disabled={agenda.jobs.status === 'loading'} onclick={() => agenda.refresh()}>Atualizar agenda</Button><Button id="btn-open-create-modal" variant="primary" onclick={() => (createModalOpen = true)}>Novo agendamento</Button></div>
  </header>
  <JobFilters bind:draft tags={agenda.tags} error={filterError} onapply={_apply} onreset={_reset} />
  {#if agenda.catalogError}<div class="flex flex-wrap gap-2 items-center"><p role="alert" class="text-error">{agenda.catalogError}</p><Button onclick={() => agenda.loadCatalogs()}>Atualizar contatos e tags</Button></div>{/if}
  <section class="agenda-summary" aria-label="Resumo dos registros carregados">
    <div class="summary-item"><span class="ui-hint">Na lista carregada</span><strong id="list-count-badge">{agenda.jobs.status === 'ready' ? jobs.length : '—'}</strong><span class="ui-hint">Até {agenda.applied.limit} registros</span></div>
    <div class="summary-item"><span class="ui-hint">Grupos na lista</span><strong>{agenda.jobs.status === 'ready' ? new Set(jobs.flatMap(job => job.group_id ? [job.group_id] : [])).size : '—'}</strong><span class="ui-hint">Podem conter mais membros</span></div>
    <button id="card-metric-errors" class="summary-item error-shortcut" disabled={agenda.jobs.status !== 'ready'} onclick={_errors}><span class="ui-hint">Erros na lista carregada</span><strong id="metric-error-count">{agenda.jobs.status === 'ready' ? errorCount : '—'}</strong><span>Ver agendamentos com erro</span></button>
  </section>
  <div class="workspace-header">
    <div><h2>Registros da agenda</h2><p class="ui-hint">CSV da agenda usa os filtros aplicados e inclui todos os resultados, sem o limite da lista. CSV do histórico inclui todas as tentativas retidas.</p></div>
    <div class="flex flex-wrap gap-2"><Button id="btn-export-jobs-csv" disabled={exporting !== null} onclick={() => _download('jobs')}>{exporting === 'jobs' ? 'Exportando…' : 'Exportar agenda CSV'}</Button><Button id="btn-export-runs-csv" disabled={exporting !== null} onclick={() => _download('runs')}>{exporting === 'runs' ? 'Exportando…' : 'Exportar histórico CSV'}</Button></div>
  </div>
  {#if csvError}<p role="alert" class="text-error">{csvError}</p>{/if}
  <div class="agenda-layout" data-inspecting={selectedId !== null}>
    <section id="wdg-job-list" class="ui-panel grid gap-4 min-w-0" aria-label="Lista da agenda" data-state={agenda.jobs.status === 'ready' && !jobs.length ? 'empty' : agenda.jobs.status}>
      <div id="view-mode-switcher" class="flex flex-wrap gap-2" role="group" aria-label="Visualização da agenda">
        <Button id="tab-view-table" aria-pressed={activeView === 'table'} onclick={() => (activeView = 'table')}>Tabela</Button>
        <Button id="tab-view-timeline" aria-pressed={activeView === 'timeline'} onclick={() => (activeView = 'timeline')}>Linha do tempo</Button>
        <Button id="tab-view-calendar" aria-pressed={activeView === 'calendar'} onclick={() => (activeView = 'calendar')}>Calendário</Button>
      </div>
      {#if agenda.jobs.status === 'error'}<div><p role="alert" class="text-error">{agenda.jobs.error}</p><Button onclick={() => agenda.loadJobs()}>Tentar novamente</Button></div>{/if}
      {#if activeView === 'table'}
        {#if agenda.jobs.status === 'loading'}<p role="status">Carregando agendamentos…</p>
        {:else if agenda.jobs.status === 'ready'}
          {#if !jobs.length}<p class="ui-hint">Nenhum agendamento encontrado para os filtros aplicados.</p>
          {:else}<JobTable {jobs} contacts={agenda.contacts} {selectedId} oninspect={_inspect} onchange={_changed} />{/if}
        {/if}
      {:else if activeView === 'timeline'}
        <JobTimelineView jobs={agenda.jobs} runs={agenda.runs} contacts={agenda.contacts} {selectedId} oninspect={_inspect} onchange={_changed} onRefreshRuns={() => agenda.loadRuns()} />
      {:else if activeView === 'calendar'}
        <JobCalendarView jobs={agenda.jobs} runs={agenda.runs} contacts={agenda.contacts} {selectedId} oninspect={_inspect} onchange={_changed} onRefreshRuns={() => agenda.loadRuns()} />
      {/if}
    </section>
    {#if selectedId}<JobInspector jobId={selectedId} refreshKey={agenda.revision} onclose={() => (selectedId = null)} oninspect={_inspect} onchange={_changed} />{/if}
  </div>
  <JobComposer open={createModalOpen} onclose={() => (createModalOpen = false)} oncreated={async () => { await Promise.all([agenda.refresh(), agenda.loadCatalogs()]); }} />
</div>

<style>
  .jobs-workspace { display: grid; gap: 24px; min-width: 0; }
  h1 { font-size: 28px; font-weight: 650; letter-spacing: -.03em; }
  h2 { font-size: 20px; font-weight: 650; }
  .workspace-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: start; gap: 16px; }
  .workspace-header > div:first-child { flex: 1 1 260px; }
  .agenda-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px; }
  .summary-item { display: grid; gap: 8px; text-align: left; background: rgb(var(--secondary-system-background)); padding: 16px; border: 1px solid rgb(var(--separator)); border-radius: 16px; }
  .summary-item strong { font-size: 24px; font-variant-numeric: tabular-nums; }
  .error-shortcut { color: rgb(var(--accent)); }
  .error-shortcut:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 2px; }
  .agenda-layout { display: grid; min-width: 0; gap: 16px; }
  @media (min-width: 1024px) { .agenda-layout[data-inspecting='true'] { grid-template-columns: minmax(0, 7fr) minmax(340px, 5fr); } }
</style>
