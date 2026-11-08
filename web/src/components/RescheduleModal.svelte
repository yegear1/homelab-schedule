<script lang="ts">
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import Dialog from './ui/Dialog.svelte';
  import Button from './ui/Button.svelte';
  let { open, jobId, onclose, onsuccess }: { open: boolean; jobId: string; onclose: () => void; onsuccess: () => void | Promise<void> } = $props();
  let runAt = $state('');
  let cronExpr = $state('');
  let busy = $state(false);
  let error = $state('');
  $effect(() => { if (open) { runAt = ''; cronExpr = ''; error = ''; } });
  function close(): void { if (!busy) onclose(); }
  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const cron = cronExpr.trim();
    const timestamp = new Date(runAt).getTime();
    error = !runAt && !cron ? 'Informe uma data/hora ou expressão cron.'
      : cron && cron.split(/\s+/).length !== 5 ? 'A expressão cron precisa de exatamente 5 campos.'
      : runAt && (!Number.isFinite(timestamp) || timestamp <= Date.now()) ? 'Escolha uma data/hora futura.' : '';
    if (error) return;
    busy = true;
    try { await api.rescheduleJob(jobId, { run_at: runAt ? new Date(runAt).toISOString() : null, cron_expr: cron || null }); }
    catch (err) { error = err instanceof Error ? err.message : 'Falha ao reagendar.'; busy = false; return; }
    toast.success('Agendamento atualizado.');
    try { await onsuccess(); } catch { toast.error('Reagendado. Falha ao atualizar a visualização.'); }
    busy = false; onclose();
  }
</script>
{#if open}
  <Dialog id="modal-reschedule" title="Reagendar recado" description="Altere a data fixa ou a regra recorrente. O servidor valida a combinação informada." onclose={close}>
    <form class="grid gap-4" onsubmit={handleSubmit} data-state={busy ? 'busy' : error ? 'error' : 'ready'}>
      <fieldset disabled={busy} class="grid gap-4">
        <div class="grid gap-1"><label for="modal-reschedule-run-at">Nova data/hora fixa</label><input class="ui-input" id="modal-reschedule-run-at" type="datetime-local" bind:value={runAt} /></div>
        <div class="grid gap-1"><label for="modal-reschedule-cron">Expressão cron (5 campos)</label><input class="ui-input" id="modal-reschedule-cron" placeholder="0 9 * * *" bind:value={cronExpr} /></div>
      </fieldset>
      {#if error}<p role="alert" class="text-error">{error}</p>{/if}
      <div class="flex flex-wrap justify-end gap-2"><Button disabled={busy} onclick={close}>Cancelar</Button><Button variant="primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Confirmar'}</Button></div>
    </form>
  </Dialog>
{/if}
