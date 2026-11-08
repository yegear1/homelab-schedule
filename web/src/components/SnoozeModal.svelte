<script lang="ts">
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import Dialog from './ui/Dialog.svelte';
  import Button from './ui/Button.svelte';
  let { open, jobId = null, groupId = null, onclose, onsuccess }: { open: boolean; jobId?: string | null; groupId?: string | null; onclose: () => void; onsuccess: () => void | Promise<void> } = $props();
  let until = $state('');
  let busy = $state(false);
  let error = $state('');
  function setQuickOffset(hours: number): void {
    const date = new Date(Date.now() + hours * 3600000);
    const pad = (value: number) => String(value).padStart(2, '0');
    until = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  $effect(() => { if (open) { setQuickOffset(1); error = ''; } });
  function close(): void { if (!busy) onclose(); }
  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const date = new Date(until);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) { error = 'A data/hora de adiamento deve ser no futuro.'; return; }
    if (!groupId && !jobId) { error = 'Selecione um recado ou grupo.'; return; }
    busy = true; error = '';
    try {
      const payload = { until: date.toISOString() };
      if (groupId) await api.snoozeGroup(groupId, payload);
      else if (jobId) await api.snoozeJob(jobId, payload);
    } catch (err) { error = err instanceof Error ? err.message : 'Falha ao adiar.'; busy = false; return; }
    toast.success('Próxima execução adiada. A regra cron foi preservada.');
    try { await onsuccess(); } catch { toast.error('Adiado. Falha ao atualizar a visualização.'); }
    busy = false; onclose();
  }
</script>
{#if open}
  <Dialog id="modal-snooze" title={groupId ? 'Adiar grupo' : 'Adiar recado'} description="Postergue apenas a próxima execução, sem alterar a regra cron." onclose={close}>
    <form class="grid gap-4" onsubmit={handleSubmit} data-state={busy ? 'busy' : error ? 'error' : 'ready'}>
      <fieldset disabled={busy} class="grid gap-4">
        <div class="flex flex-wrap gap-2">{#each [[1, '+1 hora'], [3, '+3 horas'], [24, '+1 dia'], [168, '+1 semana']] as [hours, label]}<Button onclick={() => setQuickOffset(Number(hours))}>{label}</Button>{/each}</div>
        <div class="grid gap-1"><label for="modal-snooze-until">Adiar até (horário local)</label><input class="ui-input" id="modal-snooze-until" type="datetime-local" bind:value={until} required /></div>
      </fieldset>
      {#if error}<p role="alert" class="text-error">{error}</p>{/if}
      <div class="flex flex-wrap justify-end gap-2"><Button disabled={busy} onclick={close}>Cancelar</Button><Button variant="primary" type="submit" disabled={busy}>{busy ? 'Adiando…' : 'Confirmar adiamento'}</Button></div>
    </form>
  </Dialog>
{/if}
