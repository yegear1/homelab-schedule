<script lang="ts">
  import { api, ApiClientError } from '../lib/api';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import type { Contact, Job, JobListItem, JobListFilter, JobKind, JobRun, MessageTemplate } from '../lib/types';
  import RescheduleModal from '../components/RescheduleModal.svelte';
  import SnoozeModal from '../components/SnoozeModal.svelte';
  import JobInspector from '../components/jobs/JobInspector.svelte';
  import JobComposer from '../components/jobs/JobComposer.svelte';
  import JobTimelineView from '../components/JobTimelineView.svelte';
  import JobCalendarView from '../components/JobCalendarView.svelte';

  let activeView = $state<'table' | 'timeline' | 'calendar'>('table');
  let allRuns = $state<JobRun[]>([]);
  let loadingAllRuns = $state(false);

  let jobs = $state<JobListItem[]>([]);
  let selectedId = $state<string | null>(null);
  let detailRevision = $state(0);
  const selectedJob = $derived(jobs.find(job => job.id === selectedId) ?? null);

  let templates = $state<MessageTemplate[]>([]);
  let contacts = $state<Contact[]>([]);
  let contactsByPhone = $derived(
    new Map<string, Contact>(contacts.map((c) => [c.phone, c]))
  );
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);

  // Filters (wdg-job-filters)
  let filterStatus = $state<JobListFilter>('upcoming');
  let filterFrom = $state('');
  let filterTo = $state('');
  let filterPhone = $state('');
  let filterLimit = $state(50);
  let filterTag = $state('');
  let availableTags = $state<string[]>([]);

  let expandedGroups = $state<Set<string>>(new Set());

  interface GroupedJobRow {
    type: 'group';
    groupId: string;
    title: string;
    kind: JobKind;
    cron_expr?: string | null;
    next_run_at: string | null;
    run_at?: string | null;
    source: 'sqlite' | 'yaml';
    items: JobListItem[];
    statusSummary: {
      scheduled: number;
      done: number;
      error: number;
      paused: number;
      total: number;
    };
  }

  interface SingleJobRow {
    type: 'single';
    job: JobListItem;
  }

  type JobTableRow = GroupedJobRow | SingleJobRow;

  let jobTableRows = $derived.by<JobTableRow[]>(() => {
    const result: JobTableRow[] = [];
    const groupsById = new Map<string, GroupedJobRow>();

    for (const job of jobs) {
      if (job.group_id) {
        let group = groupsById.get(job.group_id);
        if (!group) {
          const newGroup: GroupedJobRow = {
            type: 'group',
            groupId: job.group_id,
            title: job.title,
            kind: job.kind,
            cron_expr: job.cron_expr,
            next_run_at: job.next_run_at,
            run_at: job.run_at,
            source: job.source,
            items: [],
            statusSummary: {
              scheduled: 0,
              done: 0,
              error: 0,
              paused: 0,
              total: 0,
            },
          };
          groupsById.set(job.group_id, newGroup);
          result.push(newGroup);
          group = newGroup;
        }
        group.items.push(job);
        group.statusSummary.total += 1;
        if (job.status === 'scheduled') group.statusSummary.scheduled += 1;
        else if (job.status === 'done') group.statusSummary.done += 1;
        else if (job.status === 'error') group.statusSummary.error += 1;
        else if (job.status === 'paused') group.statusSummary.paused += 1;

        if (job.next_run_at && (!group.next_run_at || job.next_run_at < group.next_run_at)) {
          group.next_run_at = job.next_run_at;
        }
      } else {
        result.push({ type: 'single', job });
      }
    }

    return result;
  });

  let groupCount = $derived(
    jobTableRows.filter((r) => r.type === 'group').length
  );

  let allGroupIds = $derived(
    jobTableRows
      .filter((r): r is GroupedJobRow => r.type === 'group')
      .map((r) => r.groupId)
  );

  let isAllExpanded = $derived(
    allGroupIds.length > 0 && allGroupIds.every((id) => expandedGroups.has(id))
  );

  function toggleGroupCollapse(groupId: string) {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    expandedGroups = next;
  }

  function toggleAllGroups() {
    if (isAllExpanded) {
      expandedGroups = new Set();
    } else {
      expandedGroups = new Set(allGroupIds);
    }
  }

  let createModalOpen = $state(false);

  // Aux Modals
  let rescheduleModalOpen = $state(false);
  let rescheduleJobId = $state('');
  let snoozeModalOpen = $state(false);
  let snoozeJobId = $state<string | null>(null);
  let snoozeGroupId = $state<string | null>(null);

  $effect(() => {
    loadJobs();
    loadTemplates();
    loadContacts();
    loadTags();
  });

  async function loadTags() {
    try {
      availableTags = await api.getTags();
    } catch {
      // Non-critical
    }
  }

  async function loadTemplates() {
    try {
      templates = await api.getTemplates();
    } catch {
      // Non-critical
    }
  }

  async function loadContacts() {
    try {
      contacts = await api.getContacts();
    } catch {
      // Non-critical
    }
  }

  function resolveRecipient(job: JobListItem | Job) {
    const target = job.target_number || job.to;
    const contact = contactsByPhone.get(target);

    const cleanTarget = target.replace(/@c\.us$/, '');
    const cleanTo = (job.to || '').replace(/@c\.us$/, '');
    const isRealAlias = cleanTo !== '' && cleanTo !== cleanTarget && cleanTo !== 'eu';

    const alias = isRealAlias ? job.to : null;
    const contactName = contact?.name || null;
    const primaryName = contactName || alias;

    return {
      primaryName,
      alias,
      contactName,
      targetNumber: target,
      contact,
    };
  }

  let exportingCsv = $state(false);
  let csvError = $state('');

  async function downloadCsv(kind: 'jobs' | 'runs', jobId?: string) {
    exportingCsv = true;
    csvError = '';
    try {
      const params = new URLSearchParams();
      if (kind === 'jobs') {
        params.set('status', filterStatus);
        if (filterFrom) params.set('from', new Date(filterFrom).toISOString());
        if (filterTo) params.set('to', new Date(filterTo).toISOString());
        if (filterPhone.trim()) params.set('phone', filterPhone.trim());
        if (filterTag.trim()) params.set('tag', filterTag.trim());
      } else if (jobId) params.set('job_id', jobId);
      const path = kind === 'jobs' ? '/jobs/export.csv' : '/jobs/runs/export.csv';
      const blob = await api.downloadCsv(path, params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        link.href = url;
        link.download = kind === 'jobs' ? 'agendamentos.csv' : 'historico.csv';
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      csvError = err instanceof Error ? err.message : 'Falha ao exportar CSV';
    } finally {
      exportingCsv = false;
    }
  }

  async function loadAllRuns() {
    loadingAllRuns = true;
    try {
      allRuns = await api.getAllJobRuns(100);
    } catch {
      allRuns = [];
    } finally {
      loadingAllRuns = false;
    }
  }

  async function loadJobs() {
    loading = true;
    errorMsg = null;
    try {
      const [fetchedJobs] = await Promise.all([
        api.getJobs({
          status: filterStatus,
          from: filterFrom ? new Date(filterFrom).toISOString() : undefined,
          to: filterTo ? new Date(filterTo).toISOString() : undefined,
          phone: filterPhone.trim() || undefined,
          limit: filterLimit || undefined,
          tag: filterTag.trim() || undefined,
        }),
        loadAllRuns(),
      ]);
      jobs = fetchedJobs;

      detailRevision++;

    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        errorMsg = 'Chave x-api-key ausente ou inválida. Configure pelo ícone de perfil.';
      } else {
        errorMsg = err instanceof Error ? err.message : 'Falha ao carregar agendamentos';
      }
    } finally {
      loading = false;
    }
  }

  function inspectJob(id: string): void {
    selectedId = id;
  }

  const pendingActions = $state(new Set<string>());

  async function handleRunGroup(groupId: string) {
    if (pendingActions.has(groupId)) return;
    pendingActions.add(groupId);
    try {
      const res = await api.runGroup(groupId);
      toast.queued(`Grupo ${groupId}: ${res.affected} recados enfileirados para disparo.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao disparar grupo';
      toast.error(msg);
    } finally {
      pendingActions.delete(groupId);
    }
  }

  async function handleCancelGroup(groupId: string) {
    if (pendingActions.has(groupId)) return;
    pendingActions.add(groupId);
    try {
      const res = await api.cancelGroup(groupId);
      toast.success(`Grupo ${groupId}: ${res.affected} recados cancelados.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cancelar grupo';
      toast.error(msg);
    } finally {
      pendingActions.delete(groupId);
    }
  }

  function handleFilterSubmit(e: SubmitEvent) {
    e.preventDefault();
    loadJobs();
  }

  function resetFilters() {
    filterStatus = 'upcoming';
    filterFrom = '';
    filterTo = '';
    filterPhone = '';
    filterLimit = 50;
    filterTag = '';
    setTimeout(() => loadJobs(), 10);
  }

  async function handleRun(jobId: string) {
    if (pendingActions.has(jobId)) return;
    pendingActions.add(jobId);
    try {
      const res = await api.runJob(jobId);
      toast.queued(`POST /jobs/${jobId}/run -> 202 Accepted (${res.status}). Enfileirado no despachante.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao disparar';
      toast.error(msg);

    } finally {
      pendingActions.delete(jobId);
    }
  }

  async function handleCancel(jobItem: JobListItem | Job) {
    if (jobItem.source === 'yaml') {
      toast.error('HTTP 409 Conflict: Recados originados de routines.yaml não podem ser cancelados via API.');
      return;
    }

    if (pendingActions.has(jobItem.id)) return;
    pendingActions.add(jobItem.id);
    try {
      await api.cancelJob(jobItem.id);
      toast.success(`Recado ${jobItem.id} cancelado.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cancelar';
      toast.error(msg);
    } finally {
      pendingActions.delete(jobItem.id);
    }
  }

  async function handleRetry(jobItem: JobListItem | Job) {
    if (jobItem.source === 'yaml') {
      toast.error('HTTP 409 Conflict: Recados originados de routines.yaml são imutáveis via API.');
      return;
    }

    if (pendingActions.has(jobItem.id)) return;
    pendingActions.add(jobItem.id);
    try {
      await api.retryJob(jobItem.id);
      toast.success(`Recado ${jobItem.id} re-enfileirado com sucesso.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao re-enfileirar';
      toast.error(msg);
    } finally {
      pendingActions.delete(jobItem.id);
    }
  }

  async function handleRetryGroup(groupId: string) {
    if (pendingActions.has(groupId)) return;
    pendingActions.add(groupId);
    try {
      const res = await api.retryGroup(groupId);
      toast.success(`Grupo ${groupId}: ${res.affected} recado(s) em erro re-enfileirado(s).`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao re-enfileirar grupo';
      toast.error(msg);
    } finally {
      pendingActions.delete(groupId);
    }
  }

  async function handlePause(jobItem: JobListItem | Job) {
    if (jobItem.source === 'yaml') {
      toast.error('HTTP 409 Conflict: Recados YAML são imutáveis via API.');
      return;
    }
    if (pendingActions.has(jobItem.id)) return;
    pendingActions.add(jobItem.id);
    try {
      await api.pauseJob(jobItem.id);
      toast.success(`Recado ${jobItem.id} pausado.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao pausar';
      toast.error(msg);
    } finally {
      pendingActions.delete(jobItem.id);
    }
  }

  async function handleResume(jobItem: JobListItem | Job) {
    if (jobItem.source === 'yaml') {
      toast.error('HTTP 409 Conflict: Recados YAML são imutáveis via API.');
      return;
    }
    if (pendingActions.has(jobItem.id)) return;
    pendingActions.add(jobItem.id);
    try {
      await api.resumeJob(jobItem.id);
      toast.success(`Recado ${jobItem.id} retomado.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao retomar';
      toast.error(msg);
    } finally {
      pendingActions.delete(jobItem.id);
    }
  }

  async function handlePauseGroup(groupId: string) {
    if (pendingActions.has(groupId)) return;
    pendingActions.add(groupId);
    try {
      const res = await api.pauseGroup(groupId);
      toast.success(`Grupo ${groupId}: ${res.affected} recados pausados.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao pausar grupo';
      toast.error(msg);
    } finally {
      pendingActions.delete(groupId);
    }
  }

  async function handleResumeGroup(groupId: string) {
    if (pendingActions.has(groupId)) return;
    pendingActions.add(groupId);
    try {
      const res = await api.resumeGroup(groupId);
      toast.success(`Grupo ${groupId}: ${res.affected} recados retomados.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao retomar grupo';
      toast.error(msg);
    } finally {
      pendingActions.delete(groupId);
    }
  }

  function openSnoozeJob(jobId: string, source: string) {
    if (source === 'yaml') {
      toast.error('HTTP 409 Conflict: Recados YAML são declarativos e imutáveis via API.');
      return;
    }
    snoozeJobId = jobId;
    snoozeGroupId = null;
    snoozeModalOpen = true;
  }

  function openSnoozeGroup(groupId: string) {
    snoozeJobId = null;
    snoozeGroupId = groupId;
    snoozeModalOpen = true;
  }

  $effect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (createModalOpen) {
          createModalOpen = false;
        } else if (rescheduleModalOpen) {
          rescheduleModalOpen = false;
        } else if (snoozeModalOpen) {
          snoozeModalOpen = false;
        } else if (selectedId && !document.querySelector('[aria-modal="true"]')) {
          selectedId = null;
        }
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  function formatStatus(status: string): string {
    switch (status) {
      case 'scheduled':
        return 'Agendado';
      case 'done':
        return 'Concluído';
      case 'paused':
        return 'Pausado';
      case 'error':
        return 'Erro';
      default:
        return status;
    }
  }

  function openReschedule(jobId: string, source: string) {
    if (source === 'yaml') {
      toast.error('HTTP 409 Conflict: Recados YAML são declarativos e imutáveis via API.');
      return;
    }
    rescheduleJobId = jobId;
    rescheduleModalOpen = true;
  }

</script>

<div class="agenda-page flex flex-col w-full" data-state={loading ? 'loading' : errorMsg ? 'error' : 'ready'} id="scr-jobs">
  <!-- HEADER METRICS & STATUS RAIL -->
  <section class="grid grid-cols-1 md:grid-cols-4 gap-gutter mb-space-lg">
    <!-- METRIC 1 -->
    <div class="agenda-panel bg-surface-container-low p-space-md rounded shadow-sm flex flex-col justify-between relative overflow-hidden border border-outline-variant/10">
      <div class="flex items-center justify-between">
        <span class="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">Total Agendado</span>
        <span class="material-symbols-outlined text-primary text-[18px]">schedule</span>
      </div>
      <div class="my-space-xs flex items-baseline gap-space-xs">
        <span class="font-headline-lg text-headline-lg text-on-surface font-semibold font-mono">{jobs.length}</span>
        <span class="font-label-code-sm text-label-code-sm text-tertiary">recados na lista</span>
      </div>
      <div class="flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm pt-space-xs font-mono">
        <span>Filtro ativo:</span>
        <span class="text-primary">{filterStatus}</span>
      </div>
    </div>

    <!-- METRIC 2 -->
    <div class="agenda-panel bg-surface-container-low p-space-md rounded shadow-sm flex flex-col justify-between relative overflow-hidden border border-outline-variant/10">
      <div class="flex items-center justify-between">
        <span class="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">Despachante</span>
        <span class="material-symbols-outlined text-tertiary text-[18px]">done_all</span>
      </div>
      <div class="my-space-xs flex items-baseline gap-space-xs">
        <span class="font-headline-lg text-headline-lg text-on-surface font-semibold font-mono">202</span>
        <span class="font-label-code-sm text-label-code-sm text-tertiary font-mono">Accepted</span>
      </div>
      <div class="flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm pt-space-xs font-mono">
        <span>Gateway ack:</span>
        <span class="text-tertiary">Enfileiramento assíncrono</span>
      </div>
    </div>

    <!-- METRIC 3 -->
    <button
      type="button"
      id="card-metric-errors"
      class="agenda-panel bg-surface-container-low p-space-md rounded shadow-sm flex flex-col justify-between relative overflow-hidden border border-outline-variant/10 text-left hover:border-error/40 transition-colors cursor-pointer"
      onclick={() => {
        filterStatus = 'error';
        loadJobs();
      }}
      title="Clique para filtrar apenas jobs com erro (Dead-Letter)"
    >
      <div class="flex items-center justify-between w-full">
        <span class="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">Erros Registrados</span>
        <span class="material-symbols-outlined text-error text-[18px]">error</span>
      </div>
      <div class="my-space-xs flex items-baseline gap-space-xs">
        <span class="font-headline-lg text-headline-lg text-error font-semibold font-mono" id="metric-error-count">
          {jobs.filter((j) => j.status === 'error').length}
        </span>
        <span class="font-label-code-sm text-label-code-sm text-error">jobs com falha</span>
      </div>
      <div class="flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm pt-space-xs font-mono w-full">
        <span>Dead-Letter:</span>
        <span class="text-error hover:underline flex items-center gap-0.5">
          <span>Ver com erro</span>
          <span class="material-symbols-outlined text-[12px]">arrow_forward</span>
        </span>
      </div>
    </button>

    <!-- METRIC 4: STORAGE -->
    <div class="agenda-panel bg-surface-container-low p-space-md rounded shadow-sm flex flex-col justify-between relative overflow-hidden border border-outline-variant/10">
      <div class="flex items-center justify-between">
        <span class="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">Modo Storage</span>
        <span class="font-label-code-sm text-label-code-sm text-primary px-1.5 py-0.5 rounded bg-surface-container font-mono">WAL</span>
      </div>
      <div class="my-space-xs flex items-baseline gap-space-xs">
        <span class="font-headline-lg text-headline-lg text-on-surface font-semibold font-mono">SQLite 3</span>
      </div>
      <div class="flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm pt-space-xs font-mono">
        <span>Locks SQLite:</span>
        <span class="text-tertiary">1 writer unificado</span>
      </div>
    </div>
  </section>

  <div class="flex flex-wrap items-center gap-space-sm mb-space-md" aria-busy={exportingCsv}>
    <button type="button" id="btn-export-jobs-csv" class="px-space-md py-2 rounded bg-surface-container hover:bg-surface-bright text-on-surface font-label-ui text-label-ui cursor-pointer" disabled={exportingCsv}
      onclick={() => downloadCsv('jobs')}>Exportar agenda CSV</button>
    <button type="button" id="btn-export-runs-csv" class="px-space-md py-2 rounded bg-surface-container hover:bg-surface-bright text-on-surface font-label-ui text-label-ui cursor-pointer" disabled={exportingCsv}
      onclick={() => downloadCsv('runs')}>Exportar histórico CSV</button>
    {#if exportingCsv}<span role="status">Preparando CSV…</span>{/if}
  </div>
  {#if csvError}<p role="alert" class="text-error mb-space-md">{csvError}</p>{/if}

  <!-- WIDGET 1: JOB FILTERS (wdg-job-filters) -->
  <section class="agenda-panel bg-surface-container-low p-space-md rounded shadow-sm mb-space-lg border border-outline-variant/10" id="wdg-job-filters">
    <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md mb-space-sm">
      <div class="flex items-center gap-space-xs">
        <span class="material-symbols-outlined text-primary text-[18px]">tune</span>
        <span class="font-headline-sm text-headline-sm text-on-surface">Filtros de Execução</span>
        <span class="font-label-code-sm text-label-code-sm text-outline ml-space-xs font-mono">GET /jobs</span>
      </div>
      <div class="flex items-center gap-space-xs">
        <button
          class="px-space-md py-1.5 rounded bg-primary text-on-primary font-label-ui text-label-ui uppercase tracking-wider flex items-center gap-space-xs shadow-sm hover:brightness-110 active:brightness-95 transition-all font-semibold cursor-pointer"
          id="btn-open-create-modal"
          onclick={() => (createModalOpen = true)}
          type="button"
        >
          <span class="material-symbols-outlined text-[16px]">add_task</span>
          <span>Novo Agendamento</span>
        </button>
      </div>
    </div>

    <form class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-space-sm items-end" id="form-job-filters" onsubmit={handleFilterSubmit}>
      <!-- Campo 1: status -->
      <div class="flex flex-col gap-1 min-w-0">
        <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="filter-status">Status</label>
        <select
          class="w-full bg-surface-container-lowest text-on-surface font-label-code text-label-code rounded px-space-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          id="filter-status"
          name="status"
          bind:value={filterStatus}
        >
          <option value="upcoming">Agendados</option>
          <option value="all">Todos</option>
          <option value="done">Concluídos</option>
          <option value="paused">Pausados</option>
          <option value="error">Com Erro</option>
        </select>
      </div>

      <!-- Campo 2: from -->
      <div class="flex flex-col gap-1 min-w-0">
        <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="filter-from">Início Janela (from)</label>
        <input
          class="w-full bg-surface-container-lowest text-on-surface font-label-code-sm text-label-code-sm rounded px-space-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          id="filter-from"
          name="from"
          type="datetime-local"
          bind:value={filterFrom}
        />
      </div>

      <!-- Campo 3: to com Tooltip Explícito -->
      <div class="flex flex-col gap-1 min-w-0 relative group">
        <div class="flex items-center justify-between">
          <label class="font-label-ui text-label-ui uppercase text-on-surface-variant flex items-center gap-1 cursor-help" for="filter-to">
            <span>Fim Janela (to)</span>
            <span class="material-symbols-outlined text-primary text-[14px]">info</span>
          </label>
          <!-- Tooltip Obrigatório: 'to' = tempo, não destinatário -->
          <div class="absolute bottom-full left-0 mb-1 hidden group-hover:block w-64 p-space-sm bg-surface-container-highest text-on-surface rounded shadow-xl font-label-code-sm text-label-code-sm z-30 pointer-events-none leading-normal border border-outline-variant/20 font-mono">
            <span class="text-primary font-semibold">ATENÇÃO:</span> 'to' define o FIM DO INTERVALO DE TEMPO, não o destinatário do recado!
          </div>
        </div>
        <input
          class="w-full bg-surface-container-lowest text-on-surface font-label-code-sm text-label-code-sm rounded px-space-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          id="filter-to"
          name="to"
          type="datetime-local"
          bind:value={filterTo}
        />
      </div>

      <!-- Campo 4: phone -->
      <div class="flex flex-col gap-1 min-w-0">
        <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="filter-phone">Tel. Destinatário</label>
        <input
          class="w-full bg-surface-container-lowest text-on-surface font-label-code text-label-code rounded px-space-sm py-1.5 placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          id="filter-phone"
          name="phone"
          placeholder="+5511999990000"
          type="text"
          bind:value={filterPhone}
        />
      </div>

      <!-- Campo 5: tag -->
      <div class="flex flex-col gap-1 min-w-0">
        <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="filter-tag">Tag / Categoria</label>
        <input
          class="w-full bg-surface-container-lowest text-on-surface font-label-code text-label-code rounded px-space-sm py-1.5 placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          id="filter-tag"
          name="tag"
          list="tags-datalist"
          placeholder="ex: lembrete"
          type="text"
          bind:value={filterTag}
        />
        <datalist id="tags-datalist">
          {#each availableTags as t}
            <option value={t}>{t}</option>
          {/each}
        </datalist>
      </div>

      <!-- Campo 6: limit -->
      <div class="flex flex-col gap-1 min-w-0">
        <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="filter-limit">Limite (1-100)</label>
        <input
          class="w-full bg-surface-container-lowest text-on-surface font-label-code text-label-code rounded px-space-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          id="filter-limit"
          max="100"
          min="1"
          name="limit"
          type="number"
          bind:value={filterLimit}
        />
      </div>

      <!-- Ações Filtro -->
      <div class="flex items-center gap-space-xs pt-1">
        <button
          class="flex-1 px-space-sm py-1.5 rounded bg-surface-container-high hover:bg-surface-bright text-primary font-label-ui text-label-ui uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer font-semibold"
          type="submit"
        >
          <span class="material-symbols-outlined text-[16px]">filter_alt</span>
          <span>Filtrar</span>
        </button>
        <button
          class="px-space-sm py-1.5 rounded bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant font-label-ui text-label-ui uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
          id="btn-reset-filters"
          aria-label="Limpar filtros"
          onclick={resetFilters}
          title="Limpar Filtros"
          type="button"
        >
          <span class="material-symbols-outlined text-[16px]">restart_alt</span>
        </button>
      </div>
    </form>
  </section>

  <!-- MAIN DUAL-PANE VIEW: LIST & DETAIL -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
    <!-- WIDGET 2: JOB LIST (wdg-job-list) - 7 cols on Desktop -->
    <section class="agenda-panel lg:col-span-7 bg-surface-container-low p-space-md rounded shadow-sm flex flex-col border border-outline-variant/10" id="wdg-job-list">
      <div class="agenda-toolbar flex items-center justify-between mb-space-sm">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-on-surface-variant text-[18px]">dataset</span>
          <h2 class="font-headline-sm text-headline-sm text-on-surface">Agendas Registradas</h2>
          <span class="font-label-code-sm text-label-code-sm text-outline px-space-xs py-0.5 rounded bg-surface-container-lowest font-mono">
            JobListItem[]
          </span>
        </div>
        <div class="flex items-center gap-space-xs font-label-code-sm text-label-code-sm text-on-surface-variant font-mono flex-wrap">
          <span>Total:</span>
          <span class="font-semibold text-primary" id="list-count-badge">{jobs.length} itens</span>
          {#if groupCount > 0}
            <span class="text-outline">({groupCount} {groupCount === 1 ? 'grupo' : 'grupos'})</span>
            <button
              type="button"
              class="text-[11px] text-secondary hover:underline cursor-pointer ml-1 font-sans"
              onclick={toggleAllGroups}
            >
              {isAllExpanded ? 'Recolher todos' : 'Expandir todos'}
            </button>
          {/if}
        </div>
      </div>

      <!-- Segmented View Mode Switcher -->
      <div class="agenda-segments flex items-center gap-1 p-1 bg-surface-container-lowest rounded border border-outline-variant/10 mb-space-sm w-fit" id="view-mode-switcher">
        <button
          type="button"
          id="tab-view-table"
          aria-pressed={activeView === 'table'}
          class="px-2.5 py-1 rounded text-[12px] font-label-ui uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer {activeView === 'table' ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
          onclick={() => (activeView = 'table')}
        >
          <span class="material-symbols-outlined text-[15px]">table_rows</span>
          <span>Tabela</span>
        </button>
        <button
          type="button"
          id="tab-view-timeline"
          aria-pressed={activeView === 'timeline'}
          class="px-2.5 py-1 rounded text-[12px] font-label-ui uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer {activeView === 'timeline' ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
          onclick={() => (activeView = 'timeline')}
        >
          <span class="material-symbols-outlined text-[15px]">timeline</span>
          <span>Linha do Tempo</span>
        </button>
        <button
          type="button"
          id="tab-view-calendar"
          aria-pressed={activeView === 'calendar'}
          class="px-2.5 py-1 rounded text-[12px] font-label-ui uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer {activeView === 'calendar' ? 'bg-primary text-on-primary font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
          onclick={() => (activeView = 'calendar')}
        >
          <span class="material-symbols-outlined text-[15px]">calendar_month</span>
          <span>Calendário</span>
        </button>
      </div>

      {#if activeView === 'table'}
        <!-- Tabela Estruturada de Recados -->
        <!-- Keyboard focus enables native arrow-key scrolling of the wide table. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="agenda-table-scroll overflow-x-auto w-full" role="region" aria-label="Tabela de agendamentos" tabindex="0">
        <table aria-label="Agendamentos" class="agenda-table w-full min-w-[1080px] table-fixed text-left font-body-sm text-body-sm text-on-surface">
          <colgroup>
            <col style="width: 145px;" class="w-[145px]" />
            <col />
            <col style="width: 180px;" class="w-[180px]" />
            <col style="width: 110px;" class="w-[110px]" />
            <col style="width: 210px;" class="w-[210px]" />
          </colgroup>
          <thead>
            <tr class="bg-surface-container-lowest text-on-surface-variant font-label-ui text-label-ui uppercase tracking-wider border-b border-outline-variant/10">
              <th scope="col" class="py-2.5 px-space-sm w-[145px] whitespace-nowrap">Status</th>
              <th scope="col" class="py-2.5 px-space-sm">Título &amp; Destino</th>
              <th scope="col" class="py-2.5 px-space-sm w-[180px] whitespace-nowrap">Tipo / Próx. Execução</th>
              <th scope="col" class="py-2.5 px-space-sm w-[110px] whitespace-nowrap">Origem</th>
              <th scope="col" class="py-2.5 px-space-sm text-right w-[210px] whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody class="font-label-code-sm text-label-code-sm divide-y divide-surface-container-high/20" id="job-table-body">
            {#if loading}
              <tr>
                <td colspan="5" class="py-space-xl text-center text-outline">Carregando agendas...</td>
              </tr>
            {:else if jobs.length === 0}
              <tr>
                <td colspan="5" class="py-space-xl text-center text-outline">Nenhum job encontrado para os filtros selecionados.</td>
              </tr>
            {:else}
              {#each jobTableRows as row (row.type === 'group' ? `grp-${row.groupId}` : `job-${row.job.id}`)}
                {#if row.type === 'single'}
                  {@const job = row.job}
                  {@const isSelected = selectedJob?.id === job.id}
                  {@const recipient = resolveRecipient(job)}
                  <tr
                    class="transition-colors cursor-pointer group {isSelected ? 'bg-surface-container-high' : 'bg-surface-container hover:bg-surface-container-high/60'}"
                    data-job-id={job.id}
                    aria-current={isSelected ? 'true' : undefined}
                    onclick={() => inspectJob(job.id)}
                  >
                    <td class="py-2.5 px-space-sm whitespace-nowrap w-[145px]">
                      {#if job.status === 'error'}
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-code-sm text-label-code-sm uppercase font-mono whitespace-nowrap bg-error/15 text-error font-semibold border border-error/30" title={job.last_error ? `Erro: ${job.last_error}` : 'Erro definitivo'}>
                          <span class="material-symbols-outlined text-[13px]">error</span>
                          <span>Dead-Letter</span>
                        </span>
                      {:else}
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-code-sm text-label-code-sm uppercase font-mono whitespace-nowrap {job.status === 'scheduled' ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'}">
                          <span class="h-1.5 w-1.5 rounded-full shrink-0 {job.status === 'scheduled' ? 'bg-tertiary' : 'bg-primary'}"></span>
                          <span>{formatStatus(job.status)}</span>
                        </span>
                      {/if}
                    </td>

                    <td class="py-2.5 px-space-sm">
                      <div class="flex items-center gap-2">
                        <button type="button" class="agenda-job-title font-body-md text-body-md font-semibold transition-colors"
                          onclick={(event) => { event.stopPropagation(); inspectJob(job.id); }}>
                          {job.title}
                        </button>
                      </div>
                      <div class="text-outline flex items-center gap-1.5 flex-wrap font-mono mt-0.5">
                        <span class="material-symbols-outlined text-[13px]">call_made</span>
                        {#if recipient.primaryName}
                          {#if recipient.contact}
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-label-code-sm text-label-code-sm font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
                              title="Ver perfil de {recipient.primaryName}"
                              onclick={(e) => {
                                e.stopPropagation();
                                router.navigate(`/contacts/${recipient.contact!.id}`);
                              }}
                            >
                              <span class="material-symbols-outlined text-[12px]">person</span>
                              <span>{recipient.primaryName}</span>
                            </button>
                          {:else}
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-highest text-tertiary font-label-code-sm text-label-code-sm font-semibold">
                              <span class="material-symbols-outlined text-[12px]">bookmark</span>
                              <span>{recipient.primaryName}</span>
                            </span>
                          {/if}
                        {/if}
                        <span class="text-label-code-sm">{recipient.targetNumber}</span>
                        {#if job.template_id}
                          <span class="text-outline-variant font-label-code-sm text-label-code-sm">• tpl: {job.template_id}</span>
                        {/if}
                        {#if job.variables && Object.keys(job.variables).length > 0}
                          <span class="badge-variable-count inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-container-highest text-secondary text-[11px] font-mono" title={Object.entries(job.variables).map(([k,v]) => `${k}=${v}`).join(', ')}>
                            <span class="material-symbols-outlined text-[11px]">data_object</span>
                            <span>{Object.keys(job.variables).length} {Object.keys(job.variables).length === 1 ? 'var' : 'vars'}</span>
                          </span>
                        {/if}
                        {#if job.tags && job.tags.length > 0}
                          {#each job.tags as t}
                            <span class="badge-tag inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-mono" title="Tag: {t}">
                              <span class="material-symbols-outlined text-[11px]">label</span>
                              <span>{t}</span>
                            </span>
                          {/each}
                        {/if}
                      </div>
                      {#if job.status === 'error' && job.last_error}
                        <div class="text-error flex items-center gap-1 font-mono text-[11px] mt-0.5 truncate max-w-sm" title={job.last_error}>
                          <span class="material-symbols-outlined text-[12px] shrink-0">report_problem</span>
                          <span class="truncate">{job.last_error}</span>
                          {#if job.retry_count}
                            <span class="text-outline shrink-0 font-semibold">({job.retry_count}/3)</span>
                          {/if}
                        </div>
                      {/if}
                    </td>

                    <td class="py-2.5 px-space-sm font-mono whitespace-nowrap w-[180px]">
                      <div class="inline-block px-1.5 py-0.5 rounded bg-surface-container-lowest text-secondary font-label-code-sm text-label-code-sm">
                        {job.kind === 'cron' ? `cron: ${job.cron_expr}` : 'Único'}
                      </div>
                      <div class="text-on-surface-variant font-label-code-sm text-label-code-sm mt-0.5">
                        {job.next_run_at ? new Date(job.next_run_at).toLocaleString('pt-BR') : job.run_at ? new Date(job.run_at).toLocaleString('pt-BR') : '—'}
                      </div>
                      {#if job.until}
                        <div class="text-outline text-[11px] mt-0.5" title="Data limite para repetições (until)">
                          Até: {new Date(job.until).toLocaleDateString('pt-BR')}
                        </div>
                      {/if}
                      {#if job.max_runs}
                        <div class="text-outline text-[11px] mt-0.5" title="Contador de execuções (run_count / max_runs)">
                          Runs: {job.run_count || 0}/{job.max_runs}
                        </div>
                      {/if}
                    </td>

                    <td class="py-2.5 px-space-sm whitespace-nowrap w-[110px]">
                      <div class="flex flex-col items-start gap-1">
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-ui text-label-ui uppercase tracking-wider {job.source === 'yaml' ? 'bg-surface-container-highest text-primary-fixed' : 'bg-surface-container-high text-tertiary'}">
                          <span class="material-symbols-outlined text-[12px]">{job.source === 'yaml' ? 'code_blocks' : 'database'}</span>
                          {job.source === 'yaml' ? 'YAML' : 'SQLite'}
                        </span>
                        {#if job.source === 'yaml'}
                          <span class="font-label-code-sm text-[10px] text-outline font-mono">Imutável (409)</span>
                        {/if}
                      </div>
                    </td>

                    <td class="py-2.5 px-space-sm text-right w-[240px] whitespace-nowrap" onclick={(e) => e.stopPropagation()}>
                      <div class="flex items-center justify-end gap-1.5 flex-nowrap">
                        {#if job.source !== 'yaml' && job.status === 'error'}
                          <button disabled={pendingActions.has(job.id)}
                            class="px-2 py-1 rounded bg-error/15 hover:bg-error hover:text-on-error text-error font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold flex items-center gap-1 cursor-pointer"
                            onclick={() => handleRetry(job)}
                            title="Re-enfileirar (Resetar erro e agendar)"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[13px]">replay</span>
                            <span>Retry</span>
                          </button>
                        {/if}
                        <button disabled={pendingActions.has(job.id)}
                          class="px-2 py-1 rounded bg-surface-container-lowest hover:bg-primary hover:text-on-primary text-primary font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                          onclick={() => handleRun(job.id)}
                          title="POST /jobs/{job.id}/run"
                          type="button"
                        >
                          Disparar
                        </button>

                        {#if job.source !== 'yaml'}
                          {#if job.status === 'paused'}
                            <button disabled={pendingActions.has(job.id)}
                              class="px-2 py-1 rounded bg-secondary/15 hover:bg-secondary hover:text-on-secondary text-secondary font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                              onclick={() => handleResume(job)}
                              title="Retomar Recado (POST /jobs/{job.id}/resume)"
                              type="button"
                            >
                              Retomar
                            </button>
                          {:else if job.status === 'scheduled'}
                            <button disabled={pendingActions.has(job.id)}
                              class="px-2 py-1 rounded bg-surface-container-lowest hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                              onclick={() => handlePause(job)}
                              title="Pausar Recado (POST /jobs/{job.id}/pause)"
                              type="button"
                            >
                              Pausar
                            </button>
                          {/if}
                          {#if job.status === 'scheduled' || job.status === 'paused'}
                            <button disabled={pendingActions.has(job.id)}
                              class="p-1 rounded bg-surface-container-lowest hover:bg-primary/20 text-primary transition-all cursor-pointer flex items-center"
                              onclick={() => openSnoozeJob(job.id, job.source)}
                              title="Adiar Recado (Snooze)"
                              aria-label="Adiar Recado"
                              type="button"
                            >
                              <span class="material-symbols-outlined text-[16px]">snooze</span>
                            </button>
                          {/if}
                          <button disabled={pendingActions.has(job.id)}
                            class="px-2 py-1 rounded bg-surface-container-lowest hover:bg-surface-bright text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                            onclick={() => openReschedule(job.id, job.source)}
                            title="Reagendar"
                            type="button"
                          >
                            Editar
                          </button>
                          <button disabled={pendingActions.has(job.id)}
                            class="px-1.5 py-1 rounded bg-error-container/20 text-error hover:bg-error-container hover:text-on-error transition-all cursor-pointer"
                            onclick={() => handleCancel(job)}
                            title="Cancelar Recado"
                            aria-label="Cancelar Recado"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[16px]">cancel</span>
                          </button>
                        {:else}
                          <button
                            class="px-2 py-1 rounded bg-surface-container-lowest text-outline-variant opacity-50 font-label-ui text-label-ui uppercase tracking-wider cursor-not-allowed font-semibold"
                            disabled
                            title="Recados YAML são imutáveis via API (409)"
                            type="button"
                          >
                            Imutável
                          </button>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {:else}
                  <!-- LINHA MESTRA DO GRUPO -->
                  {@const isExpanded = expandedGroups.has(row.groupId)}
                  {@const isAnySelected = row.items.some((item) => item.id === selectedJob?.id)}
                  <tr
                    class="transition-colors cursor-pointer border-t border-secondary/30 {isAnySelected ? 'bg-secondary/15' : 'bg-surface-container-high/60 hover:bg-surface-container-high/90'}"
                    data-group-id={row.groupId}
                    onclick={() => {
                      toggleGroupCollapse(row.groupId);
                      if (!isAnySelected && row.items.length > 0) {
                        inspectJob(row.items[0].id);
                      }
                    }}
                  >
                    <!-- Status Resumido do Grupo (Sem quebra de linha) -->
                    <td class="py-2.5 px-space-sm whitespace-nowrap w-[145px]">
                      <div class="flex items-center gap-1.5 whitespace-nowrap">
                        {#if row.statusSummary.scheduled === row.items.length}
                          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-code-sm text-label-code-sm uppercase font-mono bg-tertiary/10 text-tertiary font-semibold whitespace-nowrap">
                            <span class="h-1.5 w-1.5 rounded-full bg-tertiary shrink-0"></span>
                            <span>{row.items.length} {row.items.length === 1 ? 'agendado' : 'agendados'}</span>
                          </span>
                        {:else if row.statusSummary.done === row.items.length}
                          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-code-sm text-label-code-sm uppercase font-mono bg-primary/10 text-primary font-semibold whitespace-nowrap">
                            <span class="h-1.5 w-1.5 rounded-full bg-primary shrink-0"></span>
                            <span>{row.items.length} {row.items.length === 1 ? 'enviado' : 'enviados'}</span>
                          </span>
                        {:else}
                          <div class="flex items-center gap-1 whitespace-nowrap">
                            {#if row.statusSummary.scheduled > 0}
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-label-code-sm text-[10px] uppercase font-mono bg-tertiary/10 text-tertiary whitespace-nowrap" title="{row.statusSummary.scheduled} agendados">
                                <span class="h-1 w-1 rounded-full bg-tertiary shrink-0"></span>
                                <span>{row.statusSummary.scheduled} agend.</span>
                              </span>
                            {/if}
                            {#if row.statusSummary.done > 0}
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-label-code-sm text-[10px] uppercase font-mono bg-primary/10 text-primary whitespace-nowrap" title="{row.statusSummary.done} enviados">
                                <span class="h-1 w-1 rounded-full bg-primary shrink-0"></span>
                                <span>{row.statusSummary.done} env.</span>
                              </span>
                            {/if}
                            {#if row.statusSummary.error > 0}
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-label-code-sm text-[10px] uppercase font-mono bg-error/10 text-error whitespace-nowrap" title="{row.statusSummary.error} erros">
                                <span class="h-1 w-1 rounded-full bg-error shrink-0"></span>
                                <span>{row.statusSummary.error} erro</span>
                              </span>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </td>

                    <!-- Título & Resumo de Destinatários do Grupo -->
                    <td class="py-2.5 px-space-sm">
                      <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[16px] text-secondary transition-transform {isExpanded ? 'rotate-180' : ''}">
                          expand_more
                        </span>
                        <button type="button" class="agenda-job-title font-body-md text-body-md font-semibold"
                          aria-expanded={isExpanded}
                          onclick={(event) => {
                            event.stopPropagation();
                            toggleGroupCollapse(row.groupId);
                            if (!isAnySelected && row.items.length > 0) inspectJob(row.items[0].id);
                          }}>
                          {row.title}
                        </button>
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/15 text-secondary font-label-code-sm text-label-code-sm font-semibold" title="Grupo: {row.groupId}">
                          <span class="material-symbols-outlined text-[12px]">group</span>
                          <span>Grupo ({row.items.length} destinatários)</span>
                        </span>
                      </div>
                      <div class="text-outline flex items-center gap-1.5 flex-wrap font-mono mt-0.5 pl-6">
                        <span class="material-symbols-outlined text-[13px] text-secondary">groups</span>
                        <span class="text-label-code-sm text-on-surface-variant font-medium">
                          {row.items.slice(0, 3).map((it) => resolveRecipient(it).primaryName || resolveRecipient(it).targetNumber).join(', ')}{#if row.items.length > 3}, +{row.items.length - 3} outros{/if}
                        </span>
                      </div>
                    </td>

                    <!-- Tipo / Próxima Execução -->
                    <td class="py-2.5 px-space-sm font-mono whitespace-nowrap w-[180px]">
                      <div class="inline-block px-1.5 py-0.5 rounded bg-surface-container-lowest text-secondary font-label-code-sm text-label-code-sm font-semibold">
                        {row.kind === 'cron' ? `cron: ${row.cron_expr}` : 'Único (Lote)'}
                      </div>
                      <div class="text-on-surface-variant font-label-code-sm text-label-code-sm mt-0.5">
                        {row.next_run_at ? new Date(row.next_run_at).toLocaleString('pt-BR') : row.run_at ? new Date(row.run_at).toLocaleString('pt-BR') : '—'}
                      </div>
                    </td>

                    <!-- Origem -->
                    <td class="py-2.5 px-space-sm whitespace-nowrap w-[110px]">
                      <div class="flex flex-col items-start gap-1">
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-ui text-label-ui uppercase tracking-wider {row.source === 'yaml' ? 'bg-surface-container-highest text-primary-fixed' : 'bg-secondary/15 text-secondary font-semibold'}">
                          <span class="material-symbols-outlined text-[12px]">{row.source === 'yaml' ? 'code_blocks' : 'view_agenda'}</span>
                          {row.source === 'yaml' ? 'YAML' : 'SQLite (Grupo)'}
                        </span>
                      </div>
                    </td>

                    <!-- Ações em Lote do Grupo -->
                    <td class="py-2.5 px-space-sm text-right w-[210px] whitespace-nowrap" onclick={(e) => e.stopPropagation()}>
                      <div class="flex items-center justify-end gap-1.5 flex-nowrap">
                        {#if row.source !== 'yaml' && row.statusSummary.error > 0}
                          <button disabled={pendingActions.has(row.groupId)}
                            class="px-2 py-1 rounded bg-error/15 hover:bg-error hover:text-on-error text-error font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold flex items-center gap-1 cursor-pointer"
                            onclick={() => handleRetryGroup(row.groupId)}
                            title="Re-enfileirar {row.statusSummary.error} recado(s) em erro deste grupo"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[13px]">replay</span>
                            <span>Retry ({row.statusSummary.error})</span>
                          </button>
                        {/if}

                        <button disabled={pendingActions.has(row.groupId)}
                          class="px-2 py-1 rounded bg-secondary/15 hover:bg-secondary text-secondary hover:text-on-secondary font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold flex items-center gap-1 cursor-pointer"
                          onclick={() => handleRunGroup(row.groupId)}
                          title="Disparar todos os recados deste grupo"
                          type="button"
                        >
                          <span class="material-symbols-outlined text-[13px]">send</span>
                          <span>Todos</span>
                        </button>

                        {#if row.source !== 'yaml'}
                          {#if row.statusSummary.scheduled > 0}
                            <button disabled={pendingActions.has(row.groupId)}
                              class="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                              onclick={() => handlePauseGroup(row.groupId)}
                              title="Pausar todos os recados deste grupo"
                              type="button"
                            >
                              Pausar
                            </button>
                          {/if}
                          {#if row.statusSummary.paused > 0}
                            <button disabled={pendingActions.has(row.groupId)}
                              class="px-2 py-1 rounded bg-secondary/15 hover:bg-secondary hover:text-on-secondary text-secondary font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                              onclick={() => handleResumeGroup(row.groupId)}
                              title="Retomar todos os recados deste grupo"
                              type="button"
                            >
                              Retomar
                            </button>
                          {/if}
                          <button disabled={pendingActions.has(row.groupId)}
                            class="p-1 rounded bg-surface-container-lowest hover:bg-primary/20 text-primary transition-all cursor-pointer flex items-center"
                            onclick={() => openSnoozeGroup(row.groupId)}
                            title="Adiar todos os recados deste grupo (Snooze)"
                            aria-label="Adiar Grupo"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[16px]">snooze</span>
                          </button>
                          <button disabled={pendingActions.has(row.groupId)}
                            class="px-1.5 py-1 rounded bg-error-container/20 text-error hover:bg-error-container hover:text-on-error transition-all flex items-center gap-1 font-label-ui text-label-ui uppercase tracking-wider cursor-pointer"
                            onclick={() => handleCancelGroup(row.groupId)}
                            title="Cancelar todos os recados deste grupo"
                            aria-label="Cancelar Grupo"
                            type="button"
                          >
                            <span class="material-symbols-outlined text-[16px]">cancel</span>
                          </button>
                        {/if}

                        <button
                          class="p-1 rounded bg-surface-container-lowest hover:bg-surface-container-highest text-on-surface-variant transition-all cursor-pointer"
                          onclick={() => toggleGroupCollapse(row.groupId)}
                          title={isExpanded ? 'Recolher mensagens do grupo' : 'Expandir mensagens do grupo'}
                          aria-label={isExpanded ? 'Recolher mensagens do grupo' : 'Expandir mensagens do grupo'}
                          type="button"
                        >
                          <span class="material-symbols-outlined text-[18px]">
                            {isExpanded ? 'unfold_less' : 'unfold_more'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- LINHAS FILHAS (MEMBROS DO GRUPO) -->
                  {#if isExpanded}
                    {#each row.items as memberJob, memberIdx (memberJob.id)}
                      {@const isMemberSelected = selectedJob?.id === memberJob.id}
                      {@const memberRecipient = resolveRecipient(memberJob)}
                      <tr
                        class="transition-colors cursor-pointer group/child {isMemberSelected ? 'bg-secondary/20 font-semibold' : 'bg-surface-container-lowest hover:bg-surface-container-high/40'}"
                        data-job-id={memberJob.id}
                        aria-current={isMemberSelected ? 'true' : undefined}
                        onclick={() => inspectJob(memberJob.id)}
                      >
                        <!-- Sub-status (Alinhado com master row, sem quebra de linha) -->
                        <td class="py-2.5 px-space-sm whitespace-nowrap w-[145px]">
                          <div class="flex items-center gap-1.5 whitespace-nowrap pl-1">
                            <span class="material-symbols-outlined text-[14px] text-secondary/70 shrink-0">
                              subdirectory_arrow_right
                            </span>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-code-sm text-[10px] uppercase font-mono whitespace-nowrap {memberJob.status === 'scheduled' ? 'bg-tertiary/10 text-tertiary' : memberJob.status === 'done' ? 'bg-primary/10 text-primary' : 'bg-error/15 text-error font-semibold border border-error/30'}">
                              {#if memberJob.status === 'error'}
                                <span class="material-symbols-outlined text-[11px]">error</span>
                                <span>Dead-Letter</span>
                              {:else}
                                <span class="h-1.5 w-1.5 rounded-full shrink-0 {memberJob.status === 'scheduled' ? 'bg-tertiary' : 'bg-primary'}"></span>
                                <span>{formatStatus(memberJob.status)}</span>
                              {/if}
                            </span>
                          </div>
                        </td>

                        <!-- Sub-destinatário -->
                        <td class="py-2.5 px-space-sm">
                          <div class="flex items-center gap-1.5 flex-wrap font-mono pl-6">
                            {#if memberRecipient.primaryName}
                              {#if memberRecipient.contact}
                                <button
                                  type="button"
                                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-label-code-sm text-label-code-sm font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
                                  title="Ver perfil de {memberRecipient.primaryName}"
                                  onclick={(e) => {
                                    e.stopPropagation();
                                    router.navigate(`/contacts/${memberRecipient.contact!.id}`);
                                  }}
                                >
                                  <span class="material-symbols-outlined text-[12px]">person</span>
                                  <span>{memberRecipient.primaryName}</span>
                                </button>
                              {:else}
                                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-highest text-tertiary font-label-code-sm text-label-code-sm font-semibold">
                                  <span class="material-symbols-outlined text-[12px]">bookmark</span>
                                  <span>{memberRecipient.primaryName}</span>
                                </span>
                              {/if}
                            {/if}
                            <button type="button" class="agenda-job-title text-label-code-sm"
                              aria-label="Inspecionar {memberJob.title}: {memberRecipient.targetNumber}"
                              onclick={(event) => { event.stopPropagation(); inspectJob(memberJob.id); }}>
                              {memberRecipient.targetNumber}
                            </button>
                            {#if memberJob.template_id}
                              <span class="text-outline-variant font-label-code-sm text-label-code-sm">• tpl: {memberJob.template_id}</span>
                            {/if}
                            {#if memberJob.tags && memberJob.tags.length > 0}
                              {#each memberJob.tags as t}
                                <span class="badge-tag inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono" title="Tag: {t}">
                                  <span class="material-symbols-outlined text-[10px]">label</span>
                                  <span>{t}</span>
                                </span>
                              {/each}
                            {/if}
                          </div>
                          {#if memberJob.status === 'error' && memberJob.last_error}
                            <div class="text-error flex items-center gap-1 font-mono text-[10px] mt-0.5 truncate pl-6 max-w-xs" title={memberJob.last_error}>
                              <span class="material-symbols-outlined text-[11px] shrink-0">report_problem</span>
                              <span class="truncate">{memberJob.last_error}</span>
                            </div>
                          {/if}
                        </td>

                        <!-- Sub-horário (Formato idêntico para manter largura e alinhamento) -->
                        <td class="py-2.5 px-space-sm font-mono text-outline text-label-code-sm whitespace-nowrap w-[180px]">
                          {memberJob.next_run_at ? new Date(memberJob.next_run_at).toLocaleString('pt-BR') : memberJob.run_at ? new Date(memberJob.run_at).toLocaleString('pt-BR') : '—'}
                        </td>

                        <!-- Sub-origem -->
                        <td class="py-2.5 px-space-sm whitespace-nowrap w-[110px]">
                          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-ui text-label-ui uppercase tracking-wider bg-surface-container-highest text-outline">
                            <span class="material-symbols-outlined text-[12px]">link</span>
                            <span>Membro</span>
                          </span>
                        </td>

                        <!-- Sub-ações individuais (Alinhamento e altura idênticos) -->
                        <td class="py-2.5 px-space-sm text-right w-[240px] whitespace-nowrap" onclick={(e) => e.stopPropagation()}>
                          <div class="flex items-center justify-end gap-1.5 flex-nowrap">
                            {#if memberJob.source !== 'yaml' && memberJob.status === 'error'}
                              <button disabled={pendingActions.has(memberJob.id)}
                                class="px-2 py-1 rounded bg-error/15 hover:bg-error hover:text-on-error text-error font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold flex items-center gap-1 cursor-pointer"
                                onclick={() => handleRetry(memberJob)}
                                title="Re-enfileirar apenas este destinatário"
                                type="button"
                              >
                                <span class="material-symbols-outlined text-[13px]">replay</span>
                                <span>Retry</span>
                              </button>
                            {/if}
                            <button disabled={pendingActions.has(memberJob.id)}
                              class="px-2 py-1 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                              onclick={() => handleRun(memberJob.id)}
                              title="Disparar apenas este destinatário"
                              type="button"
                            >
                              Disparar
                            </button>

                            {#if memberJob.source !== 'yaml'}
                              {#if memberJob.status === 'paused'}
                                <button disabled={pendingActions.has(memberJob.id)}
                                  class="px-2 py-1 rounded bg-secondary/15 hover:bg-secondary hover:text-on-secondary text-secondary font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                                  onclick={() => handleResume(memberJob)}
                                  title="Retomar Recado"
                                  type="button"
                                >
                                  Retomar
                                </button>
                              {:else if memberJob.status === 'scheduled'}
                                <button disabled={pendingActions.has(memberJob.id)}
                                  class="px-2 py-1 rounded bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                                  onclick={() => handlePause(memberJob)}
                                  title="Pausar Recado"
                                  type="button"
                                >
                                  Pausar
                                </button>
                              {/if}
                              {#if memberJob.status === 'scheduled' || memberJob.status === 'paused'}
                                <button disabled={pendingActions.has(memberJob.id)}
                                  class="p-1 rounded bg-surface-container hover:bg-primary/20 text-primary transition-all cursor-pointer flex items-center"
                                  onclick={() => openSnoozeJob(memberJob.id, memberJob.source)}
                                  title="Adiar Recado (Snooze)"
                                  aria-label="Adiar Recado"
                                  type="button"
                                >
                                  <span class="material-symbols-outlined text-[16px]">snooze</span>
                                </button>
                              {/if}
                              <button disabled={pendingActions.has(memberJob.id)}
                                class="px-2 py-1 rounded bg-surface-container hover:bg-surface-bright text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold cursor-pointer"
                                onclick={() => openReschedule(memberJob.id, memberJob.source)}
                                title="Reagendar este destinatário"
                                type="button"
                              >
                                Editar
                              </button>
                              <button disabled={pendingActions.has(memberJob.id)}
                                class="px-1.5 py-1 rounded bg-error-container/20 text-error hover:bg-error-container hover:text-on-error transition-all cursor-pointer"
                                onclick={() => handleCancel(memberJob)}
                                title="Cancelar apenas este destinatário"
                                aria-label="Cancelar Recado"
                                type="button"
                              >
                                <span class="material-symbols-outlined text-[16px]">cancel</span>
                              </button>
                            {/if}
                          </div>
                        </td>
                      </tr>
                    {/each}
                  {/if}
                {/if}
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    {:else if activeView === 'timeline'}
      <JobTimelineView
        jobs={jobs}
        runs={allRuns}
        selectedJobId={selectedJob?.id ?? null}
        contactsByPhone={contactsByPhone}
        onSelectJob={inspectJob}
        onRunJob={handleRun}
        onRetryJob={handleRetry}
        onCancelJob={handleCancel}
        onOpenReschedule={openReschedule}
        onRefreshRuns={loadAllRuns}
        loadingRuns={loadingAllRuns}
      />
    {:else if activeView === 'calendar'}
      <JobCalendarView
        jobs={jobs}
        runs={allRuns}
        selectedJobId={selectedJob?.id ?? null}
        contactsByPhone={contactsByPhone}
        onSelectJob={inspectJob}
        onRunJob={handleRun}
      />
    {/if}
  </section>

    {#if selectedId}
      <JobInspector jobId={selectedId} refreshKey={detailRevision} onclose={() => (selectedId = null)} oninspect={inspectJob} onchange={loadJobs} />
    {/if}
  </div>

  <JobComposer open={createModalOpen} onclose={() => (createModalOpen = false)} oncreated={async () => { await Promise.all([loadJobs(), loadTags()]); }} />
</div>

<!-- AUX MODALS -->
<RescheduleModal
  open={rescheduleModalOpen}
  jobId={rescheduleJobId}
  onclose={() => (rescheduleModalOpen = false)}
  onsuccess={() => loadJobs()}
/>

<SnoozeModal
  open={snoozeModalOpen}
  jobId={snoozeJobId}
  groupId={snoozeGroupId}
  onclose={() => (snoozeModalOpen = false)}
  onsuccess={() => loadJobs()}
/>
