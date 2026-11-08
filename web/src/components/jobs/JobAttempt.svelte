<script lang="ts">
  import type { JobRun } from '../../lib/types';
  import { formatDate } from '../../lib/jobs/agenda';
  import Button from '../ui/Button.svelte';
  import StatusBadge from '../ui/StatusBadge.svelte';
  let { run, title, selected, oninspect }: { run: JobRun; title?: string; selected: boolean; oninspect: (id: string) => void } = $props();
</script>
<article class="attempt" aria-current={selected ? 'true' : undefined}>
  <div class="flex flex-wrap gap-2 items-center"><StatusBadge tone={run.status === 'error' ? 'error' : 'success'}>{run.status === 'success' ? 'Enfileirado' : 'Falha'}</StatusBadge><span class="tabular-nums">{run.status_code ?? 'Sem código'} · {run.duration_ms.toFixed(1)} ms · {run.trigger === 'manual' ? 'Manual' : 'Agendado'}</span></div>
  <time class="tabular-nums" datetime={run.ran_at}>{formatDate(run.ran_at)}</time>
  <Button onclick={() => oninspect(run.job_id)}>Inspecionar {title || run.job_id}</Button>
  {#if run.error_message}<p class="text-error">{run.error_message}</p>{/if}
</article>
<style>
  .attempt { display: grid; gap: 8px; padding: 16px; border: 1px solid rgb(var(--separator)); border-radius: 12px; overflow-wrap: anywhere; }
  .attempt[aria-current='true'] { border-color: rgb(var(--accent)); }
</style>
