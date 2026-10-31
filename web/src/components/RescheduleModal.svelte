<script lang="ts">
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { focusTrap } from '../lib/focusTrap';

  interface Props {
    open: boolean;
    jobId: string;
    onclose: () => void;
    onsuccess: () => void;
  }

  let { open, jobId, onclose, onsuccess }: Props = $props();

  let runAt = $state('');
  let cronExpr = $state('');
  let busy = $state(false);

  $effect(() => {
    if (open) {
      runAt = '';
      cronExpr = '';
      busy = false;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!runAt && !cronExpr) {
      toast.error('Informe nova data/hora ou expressão cron de 5 campos.');
      return;
    }

    if (cronExpr && cronExpr.trim().split(/\s+/).length !== 5) {
      toast.error('Expressão cron precisa de exatamente 5 campos (minuto hora dia mês dia_semana).');
      return;
    }

    busy = true;
    try {
      const payload = {
        run_at: runAt ? new Date(runAt).toISOString() : null,
        cron_expr: cronExpr.trim() || null
      };
      await api.rescheduleJob(jobId, payload);
      toast.success(`Recado ${jobId} reagendado com sucesso.`);
      onclose();
      onsuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao reagendar';
      toast.error(msg);
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <div class="modal-backdrop" id="modal-reschedule">
    <div
      use:focusTrap
      class="modal-surface max-w-md flex flex-col gap-space-md cursor-default"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-modal-title"
      tabindex="-1"
    >
      <div class="flex items-center justify-between pb-space-xs">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-primary text-[20px]">edit_calendar</span>
          <h3 id="reschedule-modal-title" class="font-headline-sm text-headline-sm text-label">Reagendar Recado</h3>
        </div>
        <button class="modal-action modal-close text-secondary-label hover:text-label" onclick={onclose} type="button" aria-label="Fechar">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <p class="font-body-sm text-body-sm text-secondary-label">
        Atualize os parâmetros de disparo para <span class="font-label-code text-primary font-semibold font-mono">{jobId}</span>.
      </p>

      <form class="flex flex-col gap-space-md" onsubmit={handleSubmit}>
        <div class="flex flex-col gap-1">
          <label class="font-label-ui text-label-ui uppercase tracking-wider text-secondary-label" for="modal-reschedule-run-at">
            Nova Data/Hora Fixa (run_at)
          </label>
          <input
            id="modal-reschedule-run-at"
            class="bg-system-background text-label rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary"
            type="datetime-local"
            bind:value={runAt}
          />
        </div>

        <div class="flex items-center justify-center text-secondary-label font-label-code-sm text-label-code-sm">OU</div>

        <div class="flex flex-col gap-1">
          <label class="font-label-ui text-label-ui uppercase tracking-wider text-secondary-label" for="modal-reschedule-cron">
            Expressão Cron (5 campos)
          </label>
          <input
            id="modal-reschedule-cron"
            class="bg-system-background text-label rounded px-space-md py-space-sm font-label-code text-label-code font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="*/15 * * * *"
            type="text"
            bind:value={cronExpr}
          />
        </div>

        <div class="flex items-center justify-end gap-space-sm pt-space-xs">
          <button
            class="modal-action px-space-md py-space-sm rounded bg-tertiary-system-background text-secondary-label font-label-ui text-label-ui uppercase"
            onclick={onclose}
            type="button"
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            class="modal-action px-space-md py-space-sm rounded bg-primary text-on-primary font-label-ui text-label-ui uppercase font-semibold hover:opacity-90"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
