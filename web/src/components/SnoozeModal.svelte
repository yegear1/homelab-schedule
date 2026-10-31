<script lang="ts">
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { focusTrap } from '../lib/focusTrap';

  interface Props {
    open: boolean;
    jobId?: string | null;
    groupId?: string | null;
    onclose: () => void;
    onsuccess: () => void;
  }

  let { open, jobId, groupId, onclose, onsuccess }: Props = $props();

  let until = $state('');
  let busy = $state(false);

  function formatLocalDateTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
  }

  function setQuickOffset(hours: number) {
    const d = new Date(Date.now() + hours * 3600 * 1000);
    until = formatLocalDateTime(d);
  }

  $effect(() => {
    if (open) {
      // Default to +1 hour
      setQuickOffset(1);
      busy = false;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!until) {
      toast.error('Informe a data e hora para adiamento.');
      return;
    }

    const targetDate = new Date(until);
    if (isNaN(targetDate.getTime())) {
      toast.error('Data e hora inválidas.');
      return;
    }

    if (targetDate.getTime() <= Date.now()) {
      toast.error('A data/hora de adiamento deve ser no futuro.');
      return;
    }

    busy = true;
    try {
      const payload = {
        until: targetDate.toISOString()
      };
      if (groupId) {
        const res = await api.snoozeGroup(groupId, payload);
        toast.success(`Grupo ${groupId}: ${res.affected} recados adiados para ${targetDate.toLocaleString('pt-BR')}.`);
      } else if (jobId) {
        await api.snoozeJob(jobId, payload);
        toast.success(`Recado ${jobId} adiado para ${targetDate.toLocaleString('pt-BR')}.`);
      }
      onclose();
      onsuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao adiar recado';
      toast.error(msg);
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <div class="modal-backdrop" id="modal-snooze">
    <div
      use:focusTrap
      class="modal-surface max-w-md flex flex-col gap-space-md cursor-default"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snooze-modal-title"
      tabindex="-1"
    >
      <div class="flex items-center justify-between pb-space-xs">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-primary text-[20px]">snooze</span>
          <h3 id="snooze-modal-title" class="font-headline-sm text-headline-sm text-label">
            {groupId ? 'Adiar Grupo' : 'Adiar Recado (Snooze)'}
          </h3>
        </div>
        <button class="modal-action modal-close text-secondary-label hover:text-label" onclick={onclose} type="button" aria-label="Fechar">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <p class="font-body-sm text-body-sm text-secondary-label">
        Postergue a próxima execução sem alterar a regra cron do agendamento
        {#if groupId}
          para o grupo <span class="font-label-code text-primary font-semibold font-mono">{groupId}</span>.
        {:else if jobId}
          para <span class="font-label-code text-primary font-semibold font-mono">{jobId}</span>.
        {/if}
      </p>

      <!-- Botões rápidos de atalho -->
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          class="modal-action px-2.5 py-1 rounded bg-tertiary-system-background hover:bg-surface-bright text-label font-label-code-sm text-xs font-mono cursor-pointer"
          onclick={() => setQuickOffset(1)}
        >
          +1 hora
        </button>
        <button
          type="button"
          class="modal-action px-2.5 py-1 rounded bg-tertiary-system-background hover:bg-surface-bright text-label font-label-code-sm text-xs font-mono cursor-pointer"
          onclick={() => setQuickOffset(3)}
        >
          +3 horas
        </button>
        <button
          type="button"
          class="modal-action px-2.5 py-1 rounded bg-tertiary-system-background hover:bg-surface-bright text-label font-label-code-sm text-xs font-mono cursor-pointer"
          onclick={() => setQuickOffset(24)}
        >
          +1 dia
        </button>
        <button
          type="button"
          class="modal-action px-2.5 py-1 rounded bg-tertiary-system-background hover:bg-surface-bright text-label font-label-code-sm text-xs font-mono cursor-pointer"
          onclick={() => setQuickOffset(168)}
        >
          +1 semana
        </button>
      </div>

      <form class="flex flex-col gap-space-md" onsubmit={handleSubmit}>
        <div class="flex flex-col gap-1">
          <label class="font-label-ui text-label-ui uppercase tracking-wider text-secondary-label" for="modal-snooze-until">
            Adiar Até (Próxima Execução)
          </label>
          <input
            id="modal-snooze-until"
            class="bg-system-background text-label rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            type="datetime-local"
            bind:value={until}
            required
          />
        </div>

        <div class="flex items-center justify-end gap-space-sm pt-space-xs border-t border-separator/10">
          <button
            class="modal-action px-space-md py-space-sm rounded text-secondary-label hover:text-label font-label-ui text-label-ui uppercase tracking-wider cursor-pointer"
            onclick={onclose}
            type="button"
          >
            Cancelar
          </button>
          <button
            class="modal-action px-space-md py-space-sm rounded bg-primary text-on-primary font-label-ui text-label-ui uppercase tracking-wider font-semibold hover:brightness-110 active:brightness-95 flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-50"
            disabled={busy || !until}
            type="submit"
          >
            <span class="material-symbols-outlined text-[16px]">schedule</span>
            <span>{busy ? 'Adiano...' : 'Confirmar Adiamento'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
