<script lang="ts">
  import type { Contact, JobListItem, JobRun } from '../lib/types';

  interface Props {
    jobs: JobListItem[];
    runs: JobRun[];
    selectedJobId: string | null;
    contactsByPhone: Map<string, Contact>;
    onSelectJob: (jobId: string) => void;
    onRunJob: (jobId: string) => void;
    onRetryJob: (job: JobListItem) => void;
    onCancelJob: (job: JobListItem) => void;
    onOpenReschedule: (jobId: string, source: string) => void;
    onRefreshRuns?: () => void;
    loadingRuns?: boolean;
  }

  let {
    jobs,
    runs,
    selectedJobId,
    contactsByPhone,
    onSelectJob,
    onRunJob,
    onRetryJob,
    onCancelJob,
    onOpenReschedule,
    onRefreshRuns,
    loadingRuns = false,
  }: Props = $props();

  let timelineFilter = $state<'all' | 'future' | 'history'>('all');

  // Future scheduled jobs sorted by next_run_at / run_at ascending
  let futureJobs = $derived.by(() => {
    return [...jobs]
      .filter((j) => j.status === 'scheduled' || j.status === 'error' || j.status === 'paused')
      .sort((a, b) => {
        const timeA = a.next_run_at || a.run_at || '9999';
        const timeB = b.next_run_at || b.run_at || '9999';
        return timeA.localeCompare(timeB);
      });
  });

  // Past execution runs sorted by ran_at descending
  let pastRuns = $derived.by(() => {
    return [...runs].sort((a, b) => b.ran_at.localeCompare(a.ran_at));
  });

  function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function getRelativeBadge(iso: string | null | undefined): string {
    if (!iso) return '';
    try {
      const target = new Date(iso).getTime();
      const now = Date.now();
      const diffSec = Math.round((target - now) / 1000);
      const diffMin = Math.round(diffSec / 60);
      const diffHours = Math.round(diffMin / 60);
      const diffDays = Math.round(diffHours / 24);

      if (diffSec > 0) {
        if (diffMin < 60) return `em ${diffMin} min`;
        if (diffHours < 24) return `em ${diffHours}h`;
        if (diffDays === 1) return 'amanhã';
        return `em ${diffDays} dias`;
      } else {
        const absMin = Math.abs(diffMin);
        const absHours = Math.abs(diffHours);
        const absDays = Math.abs(diffDays);
        if (absMin < 1) return 'agora há pouco';
        if (absMin < 60) return `há ${absMin} min`;
        if (absHours < 24) return `há ${absHours}h`;
        if (absDays === 1) return 'ontem';
        return `há ${absDays} dias`;
      }
    } catch {
      return '';
    }
  }

  function getRecipientName(targetNumber: string, toAlias: string): string {
    const c = contactsByPhone.get(targetNumber);
    if (c) return `${c.name} (${c.phone})`;
    return toAlias;
  }
</script>

<div class="flex flex-col gap-space-md w-full" id="job-timeline-view">
  <!-- Controls Bar -->
  <div class="flex items-center justify-between flex-wrap gap-space-sm bg-surface-container-lowest p-space-sm rounded border border-outline-variant/10">
    <div class="flex items-center gap-1 bg-surface-container-low p-0.5 rounded border border-outline-variant/10">
      <button
        type="button"
        id="timeline-filter-all"
        class="px-2.5 py-1 text-[12px] font-label-ui uppercase tracking-wider rounded cursor-pointer transition-all {timelineFilter === 'all' ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
        onclick={() => (timelineFilter = 'all')}
      >
        Todos ({futureJobs.length + pastRuns.length})
      </button>
      <button
        type="button"
        id="timeline-filter-future"
        class="px-2.5 py-1 text-[12px] font-label-ui uppercase tracking-wider rounded cursor-pointer transition-all {timelineFilter === 'future' ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
        onclick={() => (timelineFilter = 'future')}
      >
        Futuros ({futureJobs.length})
      </button>
      <button
        type="button"
        id="timeline-filter-history"
        class="px-2.5 py-1 text-[12px] font-label-ui uppercase tracking-wider rounded cursor-pointer transition-all {timelineFilter === 'history' ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
        onclick={() => (timelineFilter = 'history')}
      >
        Histórico ({pastRuns.length})
      </button>
    </div>

    {#if onRefreshRuns}
      <button
        type="button"
        id="btn-timeline-refresh-runs"
        class="px-2.5 py-1 text-[12px] font-label-ui uppercase tracking-wider rounded bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center gap-1 transition-colors cursor-pointer"
        onclick={onRefreshRuns}
        disabled={loadingRuns}
      >
        <span class="material-symbols-outlined text-[14px] {loadingRuns ? 'animate-spin' : ''}">refresh</span>
        <span>Atualizar Execuções</span>
      </button>
    {/if}
  </div>

  <!-- TIMELINE CONTAINER -->
  <div class="relative pl-6 flex flex-col gap-space-lg before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-outline-variant/30">
    <!-- SECTION 1: UPCOMING SCHEDULES -->
    {#if timelineFilter === 'all' || timelineFilter === 'future'}
      <div class="flex flex-col gap-space-sm" id="timeline-future-section">
        <div class="flex items-center gap-space-xs font-label-ui text-label-ui uppercase tracking-wider text-primary font-semibold -ml-6 pl-1">
          <div class="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-[13px]">schedule</span>
          </div>
          <span>Próximos Agendamentos ({futureJobs.length})</span>
        </div>

        {#if futureJobs.length === 0}
          <div class="p-space-md bg-surface-container-lowest rounded border border-outline-variant/10 text-on-surface-variant font-label-code-sm text-center">
            Nenhum disparo futuro pendente.
          </div>
        {:else}
          <div class="flex flex-col gap-space-sm">
            {#each futureJobs as job (job.id)}
              {@const isSelected = selectedJobId === job.id}
              {@const rel = getRelativeBadge(job.next_run_at || job.run_at)}
              <div
                class="relative bg-surface-container-lowest p-space-sm rounded border transition-all {isSelected ? 'border-primary shadow-sm bg-surface-container/20' : 'border-outline-variant/10 hover:border-outline-variant/40'}"
                id="timeline-job-{job.id}"
              >
                <!-- Marker bullet on vertical line -->
                <div
                  class="absolute -left-[23px] top-4 w-3 h-3 rounded-full border-2 border-surface-container-low {job.status === 'error' ? 'bg-error' : job.status === 'paused' ? 'bg-amber-500' : 'bg-tertiary'}"
                ></div>

                <div class="flex items-start justify-between gap-space-sm flex-wrap">
                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center gap-space-xs flex-wrap">
                      <span class="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                        {job.title}
                      </span>
                      <span class="font-label-code-sm text-[11px] px-1.5 py-0.2 rounded bg-surface-container font-mono text-outline">
                        {job.id}
                      </span>
                      {#if job.source === 'yaml'}
                        <span class="font-label-code-sm text-[10px] px-1 py-0.2 rounded bg-secondary/15 text-secondary font-mono">
                          YAML
                        </span>
                      {/if}
                      {#if job.kind === 'cron'}
                        <span class="font-label-code-sm text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono" title={job.cron_expr || ''}>
                          CRON {job.cron_expr}
                        </span>
                      {:else}
                        <span class="font-label-code-sm text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant font-mono">
                          ONCE
                        </span>
                      {/if}
                    </div>

                    <div class="flex items-center gap-space-xs text-on-surface-variant font-label-code-sm text-[12px] mt-1 flex-wrap">
                      <span class="material-symbols-outlined text-[14px]">person</span>
                      <span class="text-on-surface">{getRecipientName(job.target_number, job.to)}</span>
                      <span class="text-outline">•</span>
                      <span class="material-symbols-outlined text-[14px] text-primary">alarm</span>
                      <span class="text-primary font-mono font-medium">
                        {formatDateTime(job.next_run_at || job.run_at)}
                      </span>
                      {#if rel}
                        <span class="px-1.5 py-0.2 rounded bg-primary/15 text-primary text-[10px] font-mono">
                          {rel}
                        </span>
                      {/if}
                    </div>

                    {#if job.status === 'error'}
                      <div class="mt-1.5 p-1.5 rounded bg-error/10 border border-error/20 text-error font-label-code-sm text-[11px] flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">error</span>
                        <span class="font-semibold">Dead-Letter:</span>
                        <span class="truncate">{job.last_error || 'Falha na última tentativa de envio'}</span>
                        {#if (job.retry_count ?? 0) > 0}
                          <span class="ml-auto font-mono">({job.retry_count} retries)</span>
                        {/if}
                      </div>
                    {/if}
                  </div>

                  <!-- Quick Action Buttons -->
                  <div class="flex items-center gap-1 flex-shrink-0 pt-0.5">
                    <button
                      type="button"
                      class="px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-label-ui uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                      onclick={() => onSelectJob(job.id)}
                      title="Abrir detalhes no painel lateral"
                    >
                      <span class="material-symbols-outlined text-[13px]">info</span>
                      <span>Detalhes</span>
                    </button>

                    {#if job.status === 'error' && job.source !== 'yaml'}
                      <button
                        type="button"
                        class="px-2 py-1 rounded bg-error text-on-error text-[11px] font-label-ui uppercase tracking-wider flex items-center gap-1 hover:brightness-110 transition-all cursor-pointer font-semibold shadow-sm"
                        onclick={() => onRetryJob(job)}
                        title="Re-enfileirar job em erro"
                      >
                        <span class="material-symbols-outlined text-[13px]">replay</span>
                        <span>Retry</span>
                      </button>
                    {/if}

                    <button
                      type="button"
                      class="px-2 py-1 rounded bg-tertiary/15 hover:bg-tertiary/25 text-tertiary text-[11px] font-label-ui uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer font-semibold"
                      onclick={() => onRunJob(job.id)}
                      title="Disparar agora via POST /jobs/{job.id}/run"
                    >
                      <span class="material-symbols-outlined text-[13px]">send</span>
                      <span>Disparar</span>
                    </button>

                    {#if job.source !== 'yaml'}
                      <button
                        type="button"
                        class="px-1.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-[11px] transition-colors cursor-pointer"
                        onclick={() => onOpenReschedule(job.id, job.source)}
                        title="Reagendar horário"
                      >
                        <span class="material-symbols-outlined text-[14px]">edit_calendar</span>
                      </button>
                      <button
                        type="button"
                        class="px-1.5 py-1 rounded bg-surface-container hover:bg-error/15 text-on-surface-variant hover:text-error text-[11px] transition-colors cursor-pointer"
                        onclick={() => onCancelJob(job)}
                        title="Cancelar agendamento"
                      >
                        <span class="material-symbols-outlined text-[14px]">cancel</span>
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- SECTION 2: PAST EXECUTION RUNS -->
    {#if timelineFilter === 'all' || timelineFilter === 'history'}
      <div class="flex flex-col gap-space-sm mt-space-xs" id="timeline-history-section">
        <div class="flex items-center gap-space-xs font-label-ui text-label-ui uppercase tracking-wider text-tertiary font-semibold -ml-6 pl-1">
          <div class="w-5 h-5 rounded-full bg-tertiary/20 text-tertiary flex items-center justify-center">
            <span class="material-symbols-outlined text-[13px]">history</span>
          </div>
          <span>Histórico de Execuções ({pastRuns.length})</span>
        </div>

        {#if pastRuns.length === 0}
          <div class="p-space-md bg-surface-container-lowest rounded border border-outline-variant/10 text-on-surface-variant font-label-code-sm text-center">
            Nenhuma execução registrada no histórico recente.
          </div>
        {:else}
          <div class="flex flex-col gap-space-xs">
            {#each pastRuns as run (run.id)}
              {@const isSuccess = run.status === 'success'}
              {@const rel = getRelativeBadge(run.ran_at)}
              <div
                class="relative bg-surface-container-lowest p-space-sm rounded border border-outline-variant/10 flex items-start justify-between gap-space-sm flex-wrap hover:border-outline-variant/30 transition-all"
                id="timeline-run-{run.id}"
              >
                <!-- Marker bullet on vertical line -->
                <div
                  class="absolute -left-[23px] top-3.5 w-3 h-3 rounded-full border-2 border-surface-container-low {isSuccess ? 'bg-tertiary' : 'bg-error'}"
                ></div>

                <div class="flex flex-col min-w-0 flex-1">
                  <div class="flex items-center gap-space-xs flex-wrap">
                    <span
                      class="px-1.5 py-0.2 rounded text-[10px] font-label-code font-mono font-semibold {isSuccess ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-error'}"
                    >
                      {run.status_code} {isSuccess ? 'ACCEPTED' : 'ERROR'}
                    </span>
                    <span class="font-label-code-sm text-[11px] px-1 py-0.2 rounded bg-surface-container font-mono text-on-surface-variant">
                      {run.trigger === 'manual' ? 'Disparo Manual' : 'Agendado (due-tick)'}
                    </span>
                    <span class="font-label-code-sm text-[11px] text-outline font-mono">
                      {run.duration_ms.toFixed(1)} ms
                    </span>
                    {#if rel}
                      <span class="text-on-surface-variant text-[11px] font-mono">
                        ({rel})
                      </span>
                    {/if}
                  </div>

                  <div class="flex items-center gap-space-xs text-on-surface-variant font-label-code-sm text-[12px] mt-1 flex-wrap">
                    <span class="text-on-surface font-mono">{formatDateTime(run.ran_at)}</span>
                    <span class="text-outline">•</span>
                    <span class="font-mono text-outline">job_id:</span>
                    <button
                      type="button"
                      class="text-primary hover:underline font-mono text-[11px] cursor-pointer"
                      onclick={() => onSelectJob(run.job_id)}
                      title="Inspecionar este job"
                    >
                      {run.job_id}
                    </button>
                  </div>

                  {#if run.error_message}
                    <div class="mt-1 text-error text-[11px] font-label-code-sm font-mono truncate">
                      {run.error_message}
                    </div>
                  {/if}
                </div>

                <button
                  type="button"
                  class="px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-label-ui uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer self-center"
                  onclick={() => onSelectJob(run.job_id)}
                  title="Ver detalhes do job correspondente"
                >
                  <span class="material-symbols-outlined text-[13px]">search</span>
                  <span>Ver Job</span>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
