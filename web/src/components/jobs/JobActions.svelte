<script lang="ts">
  import { api } from '../../lib/api';
  import { toast } from '../../lib/toast.svelte';
  import type { GroupActionResponse, Job, JobListItem, RunNowResponse } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  import RescheduleModal from '../RescheduleModal.svelte';
  import SnoozeModal from '../SnoozeModal.svelte';
  type Action = 'run' | 'retry' | 'pause' | 'resume' | 'cancel';
  let { job, groupId = null, anchors = true, compact = false, onchange }: { job: Job | JobListItem; groupId?: string | null; anchors?: boolean; compact?: boolean; onchange: () => Promise<void> } = $props();
  let busy = $state(false);
  let error = $state('');
  let reschedule = $state(false);
  let snooze = $state(false);
  const mutable = $derived(job.source !== 'yaml');
  function _id(value: string): string | undefined { return anchors ? value : undefined; }
  async function _act(action: Action): Promise<void> {
    if (busy || reschedule || snooze || (action !== 'run' && !mutable)) return;
    if (action === 'cancel' && !confirm(groupId ? 'Cancelar os recados elegíveis de todo o grupo?' : 'Cancelar este recado?')) return;
    busy = true; error = '';
    try {
      const result = groupId ? await _groupAction(action, groupId) : await _individualAction(action, job.id);
      if (action === 'run') toast.queued('202 · Enfileirado no gateway. A entrega não foi confirmada.');
      else toast.success(groupId && result && 'affected' in result ? `${result.affected} recado(s) alterado(s).` : 'Agendamento atualizado.');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Falha na ação. Tente novamente explicitamente.';
      busy = false; return;
    }
    try { await onchange(); }
    catch { error = 'Ação concluída. Falha ao atualizar a visualização; atualize antes de repetir.'; }
    finally { busy = false; }
  }
  async function _individualAction(action: Action, id: string): Promise<Job | RunNowResponse | void> {
    switch (action) {
      case 'run': return api.runJob(id);
      case 'retry': return api.retryJob(id);
      case 'pause': return api.pauseJob(id);
      case 'resume': return api.resumeJob(id);
      case 'cancel': return api.cancelJob(id);
    }
  }
  async function _groupAction(action: Action, id: string): Promise<GroupActionResponse> {
    switch (action) {
      case 'run': return api.runGroup(id);
      case 'retry': return api.retryGroup(id);
      case 'pause': return api.pauseGroup(id);
      case 'resume': return api.resumeGroup(id);
      case 'cancel': return api.cancelGroup(id);
    }
  }
</script>
<div class="grid gap-2" data-state={busy ? 'busy' : error ? 'error' : 'ready'}>
  {#if !compact}<p class="ui-hint">Disparar agora mantém o agendamento futuro. Re-enfileirar limpa o erro e agenda uma nova tentativa.</p>{/if}
  <div class="flex flex-wrap gap-2">
    <Button id={_id(groupId ? 'btn-group-run-all' : job.status === 'error' ? 'btn-dead-letter-run-now' : 'btn-detail-run')} disabled={busy || reschedule || snooze} onclick={() => _act('run')}>Disparar agora{groupId ? ' · grupo' : ''}</Button>
    {#if mutable}
      {#if groupId || job.status === 'error'}
        <span id={groupId || !anchors ? undefined : 'btn-detail-retry'}><Button id={_id(groupId ? 'btn-group-retry-all' : 'btn-dead-letter-retry')} disabled={busy || reschedule || snooze} onclick={() => _act('retry')}>Re-enfileirar{groupId ? ' erros do grupo' : ''}</Button></span>
      {/if}
      {#if groupId || job.status === 'scheduled'}<Button id={_id(groupId ? 'btn-group-pause-all' : 'btn-detail-pause')} disabled={busy || reschedule || snooze} onclick={() => _act('pause')}>Pausar{groupId ? ' grupo' : ''}</Button>{/if}
      {#if groupId || job.status === 'paused'}<Button id={_id(groupId ? 'btn-group-resume-all' : 'btn-detail-resume')} disabled={busy || reschedule || snooze} onclick={() => _act('resume')}>Retomar{groupId ? ' grupo' : ''}</Button>{/if}
      {#if groupId || job.status !== 'done'}<Button id={_id(groupId ? 'btn-group-snooze-all' : 'btn-detail-snooze')} disabled={busy || reschedule || snooze} onclick={() => (snooze = true)}>Adiar{groupId ? ' grupo' : ''}</Button>{/if}
      {#if !groupId}<span id={_id('detail-btn-reschedule')}><Button id={_id('btn-detail-reschedule')} disabled={busy || reschedule || snooze} onclick={() => (reschedule = true)}>Reagendar</Button></span>{/if}
      <span id={groupId || !anchors ? undefined : 'detail-btn-cancel'}><Button id={_id(groupId ? 'btn-group-cancel-all' : 'btn-detail-cancel')} variant="danger" disabled={busy || reschedule || snooze} onclick={() => _act('cancel')}>Cancelar{groupId ? ' grupo' : ' recado'}</Button></span>
    {/if}
  </div>
  {#if error}<p role="alert" class="text-error">{error}</p>{/if}
</div>
{#if reschedule}<RescheduleModal open jobId={job.id} onclose={() => (reschedule = false)} onsuccess={onchange} />{/if}
{#if snooze}<SnoozeModal open jobId={groupId ? null : job.id} {groupId} onclose={() => (snooze = false)} onsuccess={onchange} />{/if}
