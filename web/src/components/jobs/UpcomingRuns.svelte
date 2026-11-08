<script lang="ts">
  import { api } from '../../lib/api';
  import type { UpcomingRunItem } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  let { jobId }: { jobId: string } = $props();
  let runs = $state<UpcomingRunItem[]>([]);
  let loading = $state(true);
  let error = $state('');
  let generation = 0;
  $effect(() => { void _load(jobId); return () => { generation++; }; });
  async function _load(id: string): Promise<void> {
    const request = ++generation;
    loading = true; error = '';
    try {
      const result = await api.getUpcomingRuns(id, 5);
      if (request === generation) runs = result.runs;
    } catch (err) {
      if (request === generation) error = err instanceof Error ? err.message : 'Falha ao carregar próximas execuções.';
    } finally { if (request === generation) loading = false; }
  }
</script>
<section id="detail-upcoming-card" data-state={loading ? 'loading' : error ? 'error' : runs.length ? 'ready' : 'empty'}>
  <div class="flex flex-wrap items-center justify-between gap-2"><h3>Próximos disparos</h3><Button id="btn-refresh-upcoming" disabled={loading} onclick={() => _load(jobId)}>Atualizar projeção</Button></div>
  <p class="ui-hint">Até 5 ocorrências, respeitando limites e adiamentos.</p>
  {#if loading}<p id="upcoming-loading" role="status">Carregando projeção…</p>
  {:else if error}<p role="alert" class="text-error">{error}</p>
  {:else if !runs.length}<p id="upcoming-empty" class="ui-hint">Nenhuma próxima execução projetada.</p>
  {:else}<ol id="upcoming-list" class="grid gap-2 tabular-nums">
    {#each runs as run, index (run.run_at)}<li id="upcoming-item-{index}" class="rounded-xl bg-fill p-3">#{index + 1} · <time datetime={run.run_at}>{run.formatted_date}</time> · {run.time_local}</li>{/each}
  </ol>{/if}
</section>
