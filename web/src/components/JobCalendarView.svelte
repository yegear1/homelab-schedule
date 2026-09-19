<script lang="ts">
  import type { Contact, JobListItem, JobRun } from '../lib/types';

  interface Props {
    jobs: JobListItem[];
    runs: JobRun[];
    selectedJobId: string | null;
    contactsByPhone: Map<string, Contact>;
    onSelectJob: (jobId: string) => void;
    onRunJob: (jobId: string) => void;
  }

  let {
    jobs,
    runs,
    selectedJobId,
    contactsByPhone,
    onSelectJob,
    onRunJob,
  }: Props = $props();

  const now = new Date();
  let viewYear = $state(now.getFullYear());
  let viewMonth = $state(now.getMonth()); // 0-indexed

  function toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const todayKey = toDateKey(now);
  let selectedDateKey = $state<string>(todayKey);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function prevMonth() {
    if (viewMonth === 0) {
      viewMonth = 11;
      viewYear -= 1;
    } else {
      viewMonth -= 1;
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      viewMonth = 0;
      viewYear += 1;
    } else {
      viewMonth += 1;
    }
  }

  function goToToday() {
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    selectedDateKey = todayKey;
  }

  // Group jobs and runs by dateKey
  let eventsByDate = $derived.by(() => {
    const map = new Map<string, { jobs: JobListItem[]; runs: JobRun[] }>();

    function getOrCreate(key: string) {
      let entry = map.get(key);
      if (!entry) {
        entry = { jobs: [], runs: [] };
        map.set(key, entry);
      }
      return entry;
    }

    for (const job of jobs) {
      const timeStr = job.next_run_at || job.run_at;
      if (timeStr) {
        try {
          const k = toDateKey(new Date(timeStr));
          getOrCreate(k).jobs.push(job);
        } catch {
          // ignore invalid date
        }
      }
    }

    for (const run of runs) {
      if (run.ran_at) {
        try {
          const k = toDateKey(new Date(run.ran_at));
          getOrCreate(k).runs.push(run);
        } catch {
          // ignore invalid date
        }
      }
    }

    return map;
  });

  interface CalendarCell {
    date: Date;
    dateKey: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    scheduledCount: number;
    hasError: boolean;
    runsCount: number;
  }

  let calendarCells = $derived.by<CalendarCell[]>(() => {
    const cells: CalendarCell[] = [];
    const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    // Leading days from previous month
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
      const k = toDateKey(d);
      const ev = eventsByDate.get(k);
      cells.push({
        date: d,
        dateKey: k,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: k === todayKey,
        isSelected: k === selectedDateKey,
        scheduledCount: ev?.jobs.length ?? 0,
        hasError: Boolean(ev?.jobs.some((j) => j.status === 'error') || ev?.runs.some((r) => r.status === 'error')),
        runsCount: ev?.runs.length ?? 0,
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const k = toDateKey(d);
      const ev = eventsByDate.get(k);
      cells.push({
        date: d,
        dateKey: k,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: k === todayKey,
        isSelected: k === selectedDateKey,
        scheduledCount: ev?.jobs.length ?? 0,
        hasError: Boolean(ev?.jobs.some((j) => j.status === 'error') || ev?.runs.some((r) => r.status === 'error')),
        runsCount: ev?.runs.length ?? 0,
      });
    }

    // Trailing days from next month to fill grid
    const totalCells = Math.ceil(cells.length / 7) * 7;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(viewYear, viewMonth + 1, day);
      const k = toDateKey(d);
      const ev = eventsByDate.get(k);
      cells.push({
        date: d,
        dateKey: k,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: k === todayKey,
        isSelected: k === selectedDateKey,
        scheduledCount: ev?.jobs.length ?? 0,
        hasError: Boolean(ev?.jobs.some((j) => j.status === 'error') || ev?.runs.some((r) => r.status === 'error')),
        runsCount: ev?.runs.length ?? 0,
      });
    }

    return cells;
  });

  // Selected date events
  let selectedDayEvents = $derived.by(() => {
    return eventsByDate.get(selectedDateKey) || { jobs: [], runs: [] };
  });

  function formatTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  function formatSelectedHeader(dateKey: string): string {
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateKey;
    }
  }

  function getRecipientName(targetNumber: string, toAlias: string): string {
    const c = contactsByPhone.get(targetNumber);
    if (c) return `${c.name} (${c.phone})`;
    return toAlias;
  }
</script>

<div class="flex flex-col gap-space-md w-full" id="job-calendar-view">
  <!-- Calendar Navigation Header -->
  <div class="flex items-center justify-between flex-wrap gap-space-sm bg-surface-container-lowest p-space-sm rounded border border-outline-variant/10">
    <div class="flex items-center gap-space-sm">
      <h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold capitalize" id="calendar-current-month">
        {monthNames[viewMonth]} {viewYear}
      </h3>
      <button
        type="button"
        id="btn-calendar-today"
        class="px-2 py-0.5 text-[11px] font-label-ui uppercase tracking-wider rounded bg-surface-container hover:bg-surface-container-high text-primary font-semibold transition-colors cursor-pointer"
        onclick={goToToday}
      >
        Hoje
      </button>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        id="btn-calendar-prev"
        class="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
        onclick={prevMonth}
        title="Mês anterior"
        aria-label="Mês anterior"
      >
        <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      <button
        type="button"
        id="btn-calendar-next"
        class="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
        onclick={nextMonth}
        title="Próximo mês"
        aria-label="Próximo mês"
      >
        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
    </div>
  </div>

  <!-- MONTH GRID -->
  <div class="bg-surface-container-lowest rounded border border-outline-variant/10 overflow-hidden shadow-sm">
    <!-- Weekday headers -->
    <div class="grid grid-cols-7 border-b border-outline-variant/10 bg-surface-container-low/50 text-center">
      {#each weekDays as wd}
        <div class="py-2 text-[12px] font-label-ui uppercase tracking-wider text-on-surface-variant font-semibold">
          {wd}
        </div>
      {/each}
    </div>

    <!-- Days cells -->
    <div class="grid grid-cols-7 auto-rows-fr gap-px bg-outline-variant/10" id="calendar-grid">
      {#each calendarCells as cell (cell.dateKey + '_' + cell.isCurrentMonth)}
        <button
          type="button"
          class="min-h-[76px] p-1.5 flex flex-col justify-between text-left transition-colors cursor-pointer {cell.isCurrentMonth ? 'bg-surface-container-lowest hover:bg-surface-container-low/40' : 'bg-surface-container-low/20 text-outline-variant hover:bg-surface-container-low/40'} {cell.isSelected ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''}"
          onclick={() => (selectedDateKey = cell.dateKey)}
          id="calendar-day-{cell.dateKey}"
          aria-label="{cell.dateKey}"
        >
          <!-- Day number badge -->
          <div class="flex items-center justify-between">
            <span
              class="w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-mono font-medium {cell.isToday ? 'bg-primary text-on-primary font-bold shadow-xs' : cell.isCurrentMonth ? 'text-on-surface' : 'text-outline'}"
            >
              {cell.dayNumber}
            </span>

            {#if cell.hasError}
              <span class="w-2 h-2 rounded-full bg-error" title="Contém agendamento ou disparo com erro"></span>
            {/if}
          </div>

          <!-- Event indicators -->
          <div class="flex flex-col gap-0.5 mt-1">
            {#if cell.scheduledCount > 0}
              <div class="px-1 py-0.2 rounded bg-primary/10 text-primary text-[10px] font-mono truncate flex items-center gap-0.5">
                <span class="material-symbols-outlined text-[10px]">schedule</span>
                <span>{cell.scheduledCount} {cell.scheduledCount === 1 ? 'agendado' : 'agendados'}</span>
              </div>
            {/if}
            {#if cell.runsCount > 0}
              <div class="px-1 py-0.2 rounded bg-tertiary/10 text-tertiary text-[10px] font-mono truncate flex items-center gap-0.5">
                <span class="material-symbols-outlined text-[10px]">done</span>
                <span>{cell.runsCount} {cell.runsCount === 1 ? 'disparo' : 'disparos'}</span>
              </div>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- SELECTED DAY DRILLDOWN -->
  <div class="bg-surface-container-lowest p-space-md rounded border border-outline-variant/10 flex flex-col gap-space-sm" id="calendar-day-detail">
    <div class="flex items-center justify-between border-b border-outline-variant/10 pb-space-xs flex-wrap gap-space-xs">
      <div class="flex items-center gap-space-xs">
        <span class="material-symbols-outlined text-primary text-[18px]">event</span>
        <h4 class="font-headline-sm text-headline-sm text-on-surface font-semibold capitalize">
          {formatSelectedHeader(selectedDateKey)}
        </h4>
      </div>
      <span class="font-label-code-sm text-label-code-sm text-on-surface-variant font-mono">
        {selectedDayEvents.jobs.length} agendamentos • {selectedDayEvents.runs.length} execuções
      </span>
    </div>

    {#if selectedDayEvents.jobs.length === 0 && selectedDayEvents.runs.length === 0}
      <div class="p-space-md text-center text-on-surface-variant font-label-code-sm">
        Nenhum evento registrado nesta data.
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-space-xs">
        <!-- Scheduled Jobs on Date -->
        <div class="flex flex-col gap-space-xs">
          <span class="font-label-ui text-label-ui uppercase tracking-wider text-primary font-semibold flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">schedule</span>
            <span>Agendados ({selectedDayEvents.jobs.length})</span>
          </span>

          {#if selectedDayEvents.jobs.length === 0}
            <div class="p-space-sm bg-surface-container-low/30 rounded text-outline font-label-code-sm text-center">
              Sem agendamentos
            </div>
          {:else}
            <div class="flex flex-col gap-1.5">
              {#each selectedDayEvents.jobs as job (job.id)}
                {@const isSelected = selectedJobId === job.id}
                <div
                  class="p-space-sm rounded border transition-all flex items-center justify-between gap-space-xs {isSelected ? 'border-primary bg-primary/5' : 'border-outline-variant/10 bg-surface-container-low/30 hover:border-outline-variant/30'}"
                  id="calendar-event-job-{job.id}"
                >
                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center gap-space-xs flex-wrap">
                      <span class="font-mono text-primary font-medium text-[12px]">
                        {formatTime(job.next_run_at || job.run_at)}
                      </span>
                      <span class="font-semibold text-on-surface text-[12px] truncate">
                        {job.title}
                      </span>
                    </div>
                    <span class="text-on-surface-variant text-[11px] font-mono truncate">
                      {getRecipientName(job.target_number, job.to)}
                    </span>
                  </div>

                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      class="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[11px] font-label-ui uppercase tracking-wider hover:bg-surface-container-high transition-colors cursor-pointer"
                      onclick={() => onSelectJob(job.id)}
                    >
                      Inspecionar
                    </button>
                    <button
                      type="button"
                      class="p-1 rounded bg-tertiary/15 hover:bg-tertiary/25 text-tertiary transition-colors cursor-pointer"
                      onclick={() => onRunJob(job.id)}
                      title="Disparar agora"
                    >
                      <span class="material-symbols-outlined text-[14px]">send</span>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Historical Runs on Date -->
        <div class="flex flex-col gap-space-xs">
          <span class="font-label-ui text-label-ui uppercase tracking-wider text-tertiary font-semibold flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">history</span>
            <span>Disparos Realizados ({selectedDayEvents.runs.length})</span>
          </span>

          {#if selectedDayEvents.runs.length === 0}
            <div class="p-space-sm bg-surface-container-low/30 rounded text-outline font-label-code-sm text-center">
              Sem execuções
            </div>
          {:else}
            <div class="flex flex-col gap-1.5">
              {#each selectedDayEvents.runs as run (run.id)}
                {@const isSuccess = run.status === 'success'}
                <div
                  class="p-space-sm rounded border border-outline-variant/10 bg-surface-container-low/30 flex items-center justify-between gap-space-xs text-[12px]"
                  id="calendar-event-run-{run.id}"
                >
                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center gap-1 font-mono">
                      <span class="text-on-surface">{formatTime(run.ran_at)}</span>
                      <span class="text-outline">•</span>
                      <span class="font-semibold {isSuccess ? 'text-tertiary' : 'text-error'}">
                        {run.status_code} {isSuccess ? 'OK' : 'ERR'}
                      </span>
                      <span class="text-outline text-[11px]">
                        ({run.duration_ms.toFixed(0)}ms)
                      </span>
                    </div>
                    <span class="text-on-surface-variant font-mono text-[11px] truncate">
                      Job: {run.job_id} ({run.trigger === 'manual' ? 'Manual' : 'Agendado'})
                    </span>
                  </div>

                  <button
                    type="button"
                    class="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[11px] font-label-ui uppercase tracking-wider hover:bg-surface-container-high transition-colors cursor-pointer"
                    onclick={() => onSelectJob(run.job_id)}
                  >
                    Ver Job
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
