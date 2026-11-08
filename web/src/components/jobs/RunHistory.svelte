<script lang="ts">
  import { api } from '../../lib/api';
  import { toast } from '../../lib/toast.svelte';
  import type { JobRun } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  let { jobId }: { jobId: string } = $props();
  let runs = $state<JobRun[]>([]);
  let loading = $state(true);
  let error = $state('');
  let exporting = $state(false);
  let exportError = $state('');
  let generation = 0;
  $effect(() => { void _load(jobId); return () => { generation++; }; });
  async function _load(id: string): Promise<void> {
    const request = ++generation;
    loading = true; error = '';
    try {
      const result = await api.getJobRuns(id, 20);
      if (request === generation) runs = result;
    } catch (err) {
      if (request === generation) error = err instanceof Error ? err.message : 'Falha ao carregar histórico.';
    } finally { if (request === generation) loading = false; }
  }
  async function _download(): Promise<void> {
    if (exporting) return;
    exporting = true; exportError = '';
    try {
      const blob = await api.downloadCsv('/jobs/runs/export.csv', new URLSearchParams({ job_id: jobId }));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        link.href = url; link.download = 'historico.csv'; document.body.appendChild(link); link.click();
        toast.success('Histórico CSV exportado.');
      } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (err) { exportError = err instanceof Error ? err.message : 'Falha ao exportar CSV.'; }
    finally { exporting = false; }
  }
</script>
<section id="detail-runs-section" data-state={loading ? 'loading' : error ? 'error' : runs.length ? 'ready' : 'empty'}>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h3>Histórico de Disparos</h3>
    <Button id="btn-refresh-runs" disabled={loading} onclick={() => _load(jobId)}>Atualizar histórico</Button>
  </div>
  <p class="ui-hint">Até 20 tentativas retidas. Aceitação pelo gateway não confirma entrega.</p>
  <Button id="btn-export-job-runs-csv" disabled={exporting} onclick={_download}>{exporting ? 'Exportando…' : 'Exportar histórico deste agendamento CSV'}</Button>
  {#if exportError}<p role="alert" class="text-error">{exportError}</p>{/if}
  {#if loading}<p id="runs-loading" role="status">Carregando histórico…</p>
  {:else if error}<p role="alert" class="text-error">{error}</p>
  {:else if !runs.length}<p id="runs-empty" class="ui-hint">Nenhuma tentativa registrada.</p>
  {:else}<ol id="runs-list" class="grid gap-2 mt-2">
    {#each runs as run (run.id)}
      <li class="rounded-xl bg-fill p-3 tabular-nums" id="run-item-{run.id}">
        <p>{run.status === 'success' ? 'Enfileirado' : 'Falha'} · {run.status_code ?? 'Sem código'} · {run.trigger === 'manual' ? 'Manual' : 'Agendado'} · {run.duration_ms.toFixed(1)} ms</p>
        <time datetime={run.ran_at}>{new Date(run.ran_at).toLocaleString('pt-BR')}</time>
        {#if run.error_message}<p class="text-error">{run.error_message}</p>{/if}
      </li>
    {/each}
  </ol>{/if}
</section>
