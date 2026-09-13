<script lang="ts">
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';

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
  <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-space-md" id="modal-reschedule">
    <div class="bg-surface-container-low rounded-xl p-space-lg max-w-md w-full shadow-2xl flex flex-col gap-space-md border border-outline-variant/30">
      <div class="flex items-center justify-between pb-space-xs">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-primary text-[20px]">edit_calendar</span>
          <h3 class="font-headline-sm text-headline-sm text-on-surface">Reagendar Recado</h3>
        </div>
        <button class="text-on-surface-variant hover:text-on-surface" onclick={onclose} type="button">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <p class="font-body-sm text-body-sm text-on-surface-variant">
        Atualize os parâmetros de disparo para <span class="font-label-code text-primary font-semibold font-mono">{jobId}</span>.
      </p>

      <form class="flex flex-col gap-space-md" onsubmit={handleSubmit}>
        <div class="flex flex-col gap-1">
          <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="modal-reschedule-run-at">
            Nova Data/Hora Fixa (run_at)
          </label>
          <input
            id="modal-reschedule-run-at"
            class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary"
            type="datetime-local"
            bind:value={runAt}
          />
        </div>

        <div class="flex items-center justify-center text-outline font-label-code-sm text-label-code-sm">OU</div>

        <div class="flex flex-col gap-1">
          <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="modal-reschedule-cron">
            Expressão Cron (5 campos)
          </label>
          <input
            id="modal-reschedule-cron"
            class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-label-code text-label-code font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="*/15 * * * *"
            type="text"
            bind:value={cronExpr}
          />
        </div>

        <div class="flex items-center justify-end gap-space-sm pt-space-xs">
          <button
            class="px-space-md py-space-sm rounded bg-surface-container text-on-surface-variant font-label-ui text-label-ui uppercase"
            onclick={onclose}
            type="button"
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            class="px-space-md py-space-sm rounded bg-primary text-on-primary font-label-ui text-label-ui uppercase font-semibold hover:bg-primary-fixed-dim transition-all"
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
