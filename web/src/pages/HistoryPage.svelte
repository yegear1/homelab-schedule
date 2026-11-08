<script lang="ts">
  import { untrack } from 'svelte';
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { saveCsv } from '../lib/jobs/agenda';
  import type { JobRun } from '../lib/types';
  import JobInspector from '../components/jobs/JobInspector.svelte';
  import Button from '../components/ui/Button.svelte';
  let status = $state('');
  let limit = $state(50);
  let applied = $state({ status: '', limit: 50 });
  let runs = $state<JobRun[]>([]);
  let loading = $state(true);
  let error = $state('');
  let filterError = $state('');
  let exporting = $state(false);
  let exportError = $state('');
  let selectedId = $state<string | null>(null);
  let revision = $state(0);
  let generation = 0;
  $effect(() => {
    untrack(() => { void _load(); });
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) selectedId = null;
    };
    window.addEventListener('keydown', escape);
    return () => { generation++; window.removeEventListener('keydown', escape); };
  });
  async function _load(): Promise<void> {
    const request = ++generation;
    loading = true; error = '';
    try { const result = await api.getAllJobRuns(applied.limit, applied.status || undefined); if (request === generation) runs = result; }
    catch (err) { if (request === generation) error = err instanceof Error ? err.message : 'Falha ao carregar histórico.'; }
    finally { if (request === generation) loading = false; }
  }
  function _apply(): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) { filterError = 'Informe um limite entre 1 e 100.'; return; }
    filterError = ''; applied = { status, limit }; void _load();
  }
  async function _changed(): Promise<void> { revision++; await _load(); }
  async function _download(): Promise<void> {
    if (exporting) return;
    exporting = true; exportError = '';
    try {
      const params = new URLSearchParams();
      if (applied.status) params.set('status', applied.status);
      saveCsv(await api.downloadCsv('/jobs/runs/export.csv', params), 'historico.csv');
      toast.success('Histórico CSV exportado.');
    } catch (err) { exportError = err instanceof Error ? err.message : 'Falha ao exportar CSV.'; }
    finally { exporting = false; }
  }
</script>

<div id="scr-history" class="grid gap-6 min-w-0">
  <header class="flex flex-wrap justify-between gap-4"><div><h1 class="text-[28px] font-semibold">Histórico</h1><p class="ui-hint">Tentativas retidas, da mais recente à mais antiga. Enfileirado não confirma entrega.</p></div><Button disabled={loading} onclick={_load}>Atualizar histórico</Button></header>
  <form class="ui-panel flex flex-wrap items-end gap-4" onsubmit={(event) => { event.preventDefault(); _apply(); }}>
    <label class="grid gap-2" for="history-status">Resultado<select class="ui-input" id="history-status" bind:value={status}><option value="">Todos</option><option value="success">Enfileirado</option><option value="error">Falha</option></select></label>
    <label class="grid gap-2" for="history-limit">Limite<input class="ui-input" id="history-limit" type="number" min="1" max="100" required bind:value={limit} /></label>
    <Button type="submit" variant="primary">Aplicar filtros</Button>
    <Button id="btn-export-runs-csv" disabled={exporting} onclick={_download}>{exporting ? 'Exportando…' : 'Exportar histórico CSV'}</Button>
  </form>
  {#if filterError}<p role="alert" class="text-error">{filterError}</p>{/if}
  {#if exportError}<p role="alert" class="text-error">{exportError}</p>{/if}
  <p class="ui-hint">Lista: até {applied.limit} tentativas. CSV: todas as tentativas retidas do resultado aplicado, sem limite da lista.</p>
  <div class="history-layout" data-inspecting={selectedId !== null}>
    <section class="ui-panel min-w-0" aria-label="Tentativas" data-state={loading ? 'loading' : error ? 'error' : runs.length ? 'ready' : 'empty'}>
      {#if loading}<p role="status">Carregando tentativas…</p>
      {:else if error}<p role="alert" class="text-error">{error}</p><Button onclick={_load}>Tentar novamente</Button>
      {:else if !runs.length}<p class="ui-hint">Nenhuma tentativa encontrada para o resultado aplicado.</p>
      {:else}<ol class="grid gap-4">{#each runs as run (run.id)}<li class="rounded-xl bg-fill p-4 grid gap-2 break-words" data-run-id={run.id}>
        <Button onclick={() => (selectedId = run.job_id)}>Inspecionar {run.job_id}</Button>
        <p class="tabular-nums">{run.status === 'success' ? 'Enfileirado' : 'Falha'} · {run.status_code ?? 'Sem código'} · {run.duration_ms.toFixed(1)} ms · {run.trigger === 'manual' ? 'Manual' : 'Agendado'}</p>
        <time datetime={run.ran_at}>{new Date(run.ran_at).toLocaleString('pt-BR')}</time>
        {#if run.error_message}<p class="text-error">{run.error_message}</p>{/if}
      </li>{/each}</ol>{/if}
    </section>
    {#if selectedId}<JobInspector jobId={selectedId} refreshKey={revision} oninspect={(id) => (selectedId = id)} onclose={() => (selectedId = null)} onchange={_changed} />{/if}
  </div>
</div>
<style>
  .history-layout { display: grid; gap: 16px; min-width: 0; }
  input, select { max-width: 100%; }
  @media (min-width: 1024px) { .history-layout[data-inspecting='true'] { grid-template-columns: minmax(0, 7fr) minmax(340px, 5fr); } }
</style>
