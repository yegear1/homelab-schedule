<script lang="ts">
  import { api, ApiClientError } from '../lib/api';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import type { Contact, Job, JobListItem, JobListFilter, JobKind, MessageTemplate } from '../lib/types';
  import RescheduleModal from '../components/RescheduleModal.svelte';
  import ContactPickerModal from '../components/ContactPickerModal.svelte';
  import { focusTrap } from '../lib/focusTrap';

  let jobs = $state<JobListItem[]>([]);
  let selectedJob = $state<Job | null>(null);
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

  // Group & Batch State
  let groupMembers = $state<JobListItem[]>([]);
  let loadingGroupMembers = $state(false);
  let collapsedGroups = $state<Set<string>>(new Set());

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

  function toggleGroupCollapse(groupId: string) {
    const next = new Set(collapsedGroups);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    collapsedGroups = next;
  }

  function toggleAllGroups() {
    const allGroupIds = jobTableRows
      .filter((r): r is GroupedJobRow => r.type === 'group')
      .map((r) => r.groupId);
    if (collapsedGroups.size > 0) {
      collapsedGroups = new Set();
    } else {
      collapsedGroups = new Set(allGroupIds);
    }
  }

  // Create Job Modal State (wdg-job-create)
  let createModalOpen = $state(false);
  let createTitle = $state('');
  let createKind = $state<JobKind>('once');
  let createRunAt = $state('');
  let createCronExpr = $state('');
  let createRecipients = $state<string[]>(['eu']);
  let recipientInput = $state('');
  let createCreatedBy = $state('');
  let createPayloadMode = $state<'direct' | 'template'>('direct');
  let createContent = $state('');
  let createTemplateId = $state('');
  let creatingJob = $state(false);

  // Aux Modals
  let rescheduleModalOpen = $state(false);
  let rescheduleJobId = $state('');
  let contactPickerOpen = $state(false);
  let contactPickerTargetField = $state<'to' | 'created_by'>('to');

  $effect(() => {
    loadJobs();
    loadTemplates();
    loadContacts();
  });

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

  async function loadJobs() {
    loading = true;
    errorMsg = null;
    try {
      jobs = await api.getJobs({
        status: filterStatus,
        from: filterFrom ? new Date(filterFrom).toISOString() : undefined,
        to: filterTo ? new Date(filterTo).toISOString() : undefined,
        phone: filterPhone.trim() || undefined,
        limit: filterLimit || undefined,
      });

      if (jobs.length > 0) {
        if (!selectedJob || !jobs.find((j) => j.id === selectedJob?.id)) {
          await inspectJob(jobs[0].id);
        }
      } else {
        selectedJob = null;
      }
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

  async function inspectJob(id: string) {
    try {
      selectedJob = await api.getJob(id);
      if (selectedJob?.group_id) {
        await loadGroupMembers(selectedJob.group_id);
      } else {
        groupMembers = [];
      }
    } catch (err: unknown) {
      toast.error('Falha ao carregar detalhe do job.');
    }
  }

  async function loadGroupMembers(groupId: string) {
    loadingGroupMembers = true;
    try {
      groupMembers = await api.getJobs({ status: 'all', group_id: groupId });
    } catch {
      groupMembers = [];
    } finally {
      loadingGroupMembers = false;
    }
  }

  async function handleRunGroup(groupId: string) {
    try {
      const res = await api.runGroup(groupId);
      toast.queued(`Grupo ${groupId}: ${res.affected} recados enfileirados para disparo.`);
      await loadJobs();
      if (selectedJob?.group_id === groupId) {
        await loadGroupMembers(groupId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao disparar grupo';
      toast.error(msg);
    }
  }

  async function handleCancelGroup(groupId: string) {
    try {
      const res = await api.cancelGroup(groupId);
      toast.success(`Grupo ${groupId}: ${res.affected} recados cancelados.`);
      await loadJobs();
      if (selectedJob?.group_id === groupId) {
        await loadGroupMembers(groupId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cancelar grupo';
      toast.error(msg);
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
    setTimeout(() => loadJobs(), 10);
  }

  async function handleRun(jobId: string) {
    try {
      const res = await api.runJob(jobId);
      toast.queued(`POST /jobs/${jobId}/run -> 202 Accepted (${res.status}). Enfileirado no despachante.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao disparar';
      toast.error(msg);
    }
  }

  async function handleCancel(jobItem: JobListItem | Job) {
    if (jobItem.source === 'yaml') {
      toast.error('HTTP 409 Conflict: Recados originados de routines.yaml não podem ser cancelados via API.');
      return;
    }

    try {
      await api.cancelJob(jobItem.id);
      toast.success(`Recado ${jobItem.id} cancelado.`);
      await loadJobs();
      if (selectedJob?.id === jobItem.id) {
        selectedJob = await api.getJob(jobItem.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cancelar';
      toast.error(msg);
    }
  }

  $effect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (createModalOpen) {
          createModalOpen = false;
        } else if (rescheduleModalOpen) {
          rescheduleModalOpen = false;
        } else if (contactPickerOpen) {
          contactPickerOpen = false;
        } else if (selectedJob) {
          selectedJob = null;
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

  function triggerContactPicker(targetField: 'to' | 'created_by') {
    contactPickerTargetField = targetField;
    contactPickerOpen = true;
  }

  function addRecipient(val?: string) {
    const raw = val !== undefined ? val : recipientInput;
    const clean = raw.trim();
    if (!clean) return;
    const parts = clean.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
    const set = new Set(createRecipients);
    for (const p of parts) {
      set.add(p);
    }
    createRecipients = Array.from(set);
    recipientInput = '';
  }

  function removeRecipient(index: number) {
    createRecipients = createRecipients.filter((_, i) => i !== index);
  }

  function onContactPicked(phoneOrAlias: string, _name: string) {
    if (contactPickerTargetField === 'to') {
      addRecipient(phoneOrAlias);
    } else {
      createCreatedBy = phoneOrAlias;
    }
  }

  async function handleCreateJob(e: SubmitEvent) {
    e.preventDefault();
    if (!createTitle.trim()) {
      toast.error('Informe o título do recado.');
      return;
    }

    if (recipientInput.trim()) {
      addRecipient(recipientInput.trim());
    }

    if (createRecipients.length === 0) {
      toast.error('Adicione ao menos um destinatário.');
      return;
    }

    if (createKind === 'once' && !createRunAt) {
      toast.error('Data e hora (run_at) são obrigatórias para execução única.');
      return;
    }

    if (createKind === 'cron') {
      if (!createCronExpr.trim() || createCronExpr.trim().split(/\s+/).length !== 5) {
        toast.error('Expressão cron precisa de exatamente 5 campos.');
        return;
      }
    }

    const payloadContent = createPayloadMode === 'direct' ? createContent.trim() : null;
    const payloadTemplateId = createPayloadMode === 'template' ? createTemplateId.trim() : null;

    if (!payloadContent && !payloadTemplateId) {
      toast.error('Forneça o conteúdo em texto direto ou selecione um Template ID.');
      return;
    }

    creatingJob = true;
    try {
      if (createRecipients.length > 1) {
        const batchRes = await api.createBatchJobs({
          title: createTitle.trim(),
          recipients: createRecipients,
          kind: createKind,
          run_at: createKind === 'once' && createRunAt ? new Date(createRunAt).toISOString() : null,
          cron_expr: createKind === 'cron' ? createCronExpr.trim() : null,
          content: payloadContent,
          template_id: payloadTemplateId,
          created_by: createCreatedBy.trim() || null,
        });
        toast.success(`Grupo criado com ${batchRes.count} agendamentos vinculados.`);
      } else {
        await api.createJob({
          title: createTitle.trim(),
          to: createRecipients[0],
          kind: createKind,
          run_at: createKind === 'once' && createRunAt ? new Date(createRunAt).toISOString() : null,
          cron_expr: createKind === 'cron' ? createCronExpr.trim() : null,
          content: payloadContent,
          template_id: payloadTemplateId,
          created_by: createCreatedBy.trim() || null,
        });
        toast.success(`Job "${createTitle}" registrado na agenda.`);
      }

      createModalOpen = false;
      createTitle = '';
      createContent = '';
      createTemplateId = '';
      createRunAt = '';
      createCronExpr = '';
      createRecipients = ['eu'];
      recipientInput = '';
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao agendar';
      toast.error(msg);
    } finally {
      creatingJob = false;
    }
  }
</script>

<div class="flex flex-col w-full" data-state={loading ? 'loading' : errorMsg ? 'error' : 'ready'} id="scr-jobs">
  <!-- HEADER METRICS & STATUS RAIL -->
  <section class="grid grid-cols-1 md:grid-cols-4 gap-gutter mb-space-lg">
    <!-- METRIC 1 -->
    <div class="bg-surface-container-low p-space-md rounded shadow-sm flex flex-col justify-between relative overflow-hidden border border-outline-variant/10">
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
    <div class="bg-surface-container-low p-space-md rounded shadow-sm flex flex-col justify-between relative overflow-hidden border border-outline-variant/10">
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
    <div class="bg-surface-container-low p-space-md rounded shadow-sm flex flex-col justify-between relative overflow-hidden border border-outline-variant/10">
      <div class="flex items-center justify-between">
        <span class="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">Erros Registrados</span>
        <span class="material-symbols-outlined text-error text-[18px]">error</span>
      </div>
      <div class="my-space-xs flex items-baseline gap-space-xs">
        <span class="font-headline-lg text-headline-lg text-error font-semibold font-mono">
          {jobs.filter((j) => j.status === 'error').length}
        </span>
        <span class="font-label-code-sm text-label-code-sm text-error">jobs com falha</span>
      </div>
      <div class="flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm pt-space-xs font-mono">
        <span>Retentativas max:</span>
        <span class="text-outline">3 tentativas</span>
      </div>
    </div>

    <!-- METRIC 4: STORAGE -->
    <div class="bg-surface-container-low p-space-md rounded shadow-sm flex flex-col justify-between relative overflow-hidden border border-outline-variant/10">
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

  <!-- WIDGET 1: JOB FILTERS (wdg-job-filters) -->
  <section class="bg-surface-container-low p-space-md rounded shadow-sm mb-space-lg border border-outline-variant/10" id="wdg-job-filters">
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

    <form class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-space-sm items-end" id="form-job-filters" onsubmit={handleFilterSubmit}>
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

      <!-- Campo 5: limit -->
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
    <section class="lg:col-span-7 bg-surface-container-low p-space-md rounded shadow-sm flex flex-col border border-outline-variant/10" id="wdg-job-list">
      <div class="flex items-center justify-between mb-space-sm">
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
              {collapsedGroups.size > 0 ? 'Expandir todos' : 'Recolher todos'}
            </button>
          {/if}
        </div>
      </div>

      <!-- Tabela Estruturada de Recados -->
      <div class="overflow-x-auto w-full">
        <table class="w-full min-w-[660px] text-left font-body-sm text-body-sm text-on-surface">
          <thead>
            <tr class="bg-surface-container-lowest text-on-surface-variant font-label-ui text-label-ui uppercase tracking-wider border-b border-outline-variant/10">
              <th class="py-2.5 px-space-sm">Status</th>
              <th class="py-2.5 px-space-sm">Título &amp; Destino</th>
              <th class="py-2.5 px-space-sm">Tipo / Próx. Execução</th>
              <th class="py-2.5 px-space-sm">Origem</th>
              <th class="py-2.5 px-space-sm text-right min-w-[195px]">Ações</th>
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
                    onclick={() => inspectJob(job.id)}
                  >
                    <td class="py-2.5 px-space-sm">
                      <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-code-sm text-label-code-sm uppercase font-mono {job.status === 'scheduled' ? 'bg-tertiary/10 text-tertiary' : job.status === 'done' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}">
                        <span class="h-1.5 w-1.5 rounded-full {job.status === 'scheduled' ? 'bg-tertiary' : job.status === 'done' ? 'bg-primary' : 'bg-error'}"></span>
                        {formatStatus(job.status)}
                      </span>
                    </td>

                    <td class="py-2.5 px-space-sm">
                      <div class="flex items-center gap-2">
                        <span class="font-body-md text-body-md font-semibold text-on-surface group-hover:text-primary transition-colors">
                          {job.title}
                        </span>
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
                      </div>
                    </td>

                    <td class="py-2.5 px-space-sm font-mono">
                      <div class="inline-block px-1.5 py-0.5 rounded bg-surface-container-lowest text-secondary font-label-code-sm text-label-code-sm">
                        {job.kind === 'cron' ? `cron: ${job.cron_expr}` : 'Único'}
                      </div>
                      <div class="text-on-surface-variant font-label-code-sm text-label-code-sm mt-0.5">
                        {job.next_run_at ? new Date(job.next_run_at).toLocaleString('pt-BR') : job.run_at ? new Date(job.run_at).toLocaleString('pt-BR') : '—'}
                      </div>
                    </td>

                    <td class="py-2.5 px-space-sm">
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

                    <td class="py-2.5 px-space-sm text-right min-w-[195px]" onclick={(e) => e.stopPropagation()}>
                      <div class="flex items-center justify-end gap-1.5 flex-nowrap">
                        <button
                          class="px-2 py-1 rounded bg-surface-container-lowest hover:bg-primary hover:text-on-primary text-primary font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold"
                          onclick={() => handleRun(job.id)}
                          title="POST /jobs/{job.id}/run"
                          type="button"
                        >
                          Disparar
                        </button>

                        {#if job.source !== 'yaml'}
                          <button
                            class="px-2 py-1 rounded bg-surface-container-lowest hover:bg-surface-bright text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold"
                            onclick={() => openReschedule(job.id, job.source)}
                            title="Reagendar"
                            type="button"
                          >
                            Editar
                          </button>
                          <button
                            class="px-1.5 py-1 rounded bg-error-container/20 text-error hover:bg-error-container hover:text-on-error transition-all"
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
                  {@const isExpanded = !collapsedGroups.has(row.groupId) || (selectedJob?.group_id === row.groupId)}
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
                    <!-- Status Resumido do Grupo -->
                    <td class="py-2.5 px-space-sm">
                      <div class="flex flex-col gap-1">
                        {#if row.statusSummary.scheduled === row.items.length}
                          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-code-sm text-label-code-sm uppercase font-mono bg-tertiary/10 text-tertiary font-semibold">
                            <span class="h-1.5 w-1.5 rounded-full bg-tertiary"></span>
                            {row.items.length} {row.items.length === 1 ? 'agendado' : 'agendados'}
                          </span>
                        {:else if row.statusSummary.done === row.items.length}
                          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-code-sm text-label-code-sm uppercase font-mono bg-primary/10 text-primary font-semibold">
                            <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            {row.items.length} {row.items.length === 1 ? 'enviado' : 'enviados'}
                          </span>
                        {:else}
                          <div class="flex items-center gap-1 flex-wrap">
                            {#if row.statusSummary.scheduled > 0}
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-label-code-sm text-[10px] uppercase font-mono bg-tertiary/10 text-tertiary" title="{row.statusSummary.scheduled} agendados">
                                <span class="h-1 w-1 rounded-full bg-tertiary"></span>
                                {row.statusSummary.scheduled} agend.
                              </span>
                            {/if}
                            {#if row.statusSummary.done > 0}
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-label-code-sm text-[10px] uppercase font-mono bg-primary/10 text-primary" title="{row.statusSummary.done} enviados">
                                <span class="h-1 w-1 rounded-full bg-primary"></span>
                                {row.statusSummary.done} env.
                              </span>
                            {/if}
                            {#if row.statusSummary.error > 0}
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-label-code-sm text-[10px] uppercase font-mono bg-error/10 text-error" title="{row.statusSummary.error} erros">
                                <span class="h-1 w-1 rounded-full bg-error"></span>
                                {row.statusSummary.error} erro
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
                        <span class="font-body-md text-body-md font-semibold text-on-surface">
                          {row.title}
                        </span>
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
                    <td class="py-2.5 px-space-sm font-mono">
                      <div class="inline-block px-1.5 py-0.5 rounded bg-surface-container-lowest text-secondary font-label-code-sm text-label-code-sm font-semibold">
                        {row.kind === 'cron' ? `cron: ${row.cron_expr}` : 'Único (Lote)'}
                      </div>
                      <div class="text-on-surface-variant font-label-code-sm text-label-code-sm mt-0.5">
                        {row.next_run_at ? new Date(row.next_run_at).toLocaleString('pt-BR') : row.run_at ? new Date(row.run_at).toLocaleString('pt-BR') : '—'}
                      </div>
                    </td>

                    <!-- Origem -->
                    <td class="py-2.5 px-space-sm">
                      <div class="flex flex-col items-start gap-1">
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-ui text-label-ui uppercase tracking-wider {row.source === 'yaml' ? 'bg-surface-container-highest text-primary-fixed' : 'bg-secondary/15 text-secondary font-semibold'}">
                          <span class="material-symbols-outlined text-[12px]">{row.source === 'yaml' ? 'code_blocks' : 'view_agenda'}</span>
                          {row.source === 'yaml' ? 'YAML' : 'SQLite (Grupo)'}
                        </span>
                      </div>
                    </td>

                    <!-- Ações em Lote do Grupo -->
                    <td class="py-2.5 px-space-sm text-right min-w-[195px]" onclick={(e) => e.stopPropagation()}>
                      <div class="flex items-center justify-end gap-1.5 flex-nowrap">
                        <button
                          class="px-2 py-1 rounded bg-secondary/15 hover:bg-secondary text-secondary hover:text-on-secondary font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold flex items-center gap-1"
                          onclick={() => handleRunGroup(row.groupId)}
                          title="Disparar todos os recados deste grupo"
                          type="button"
                        >
                          <span class="material-symbols-outlined text-[13px]">send</span>
                          <span>Todos</span>
                        </button>

                        {#if row.source !== 'yaml'}
                          <button
                            class="px-1.5 py-1 rounded bg-error-container/20 text-error hover:bg-error-container hover:text-on-error transition-all flex items-center gap-1 font-label-ui text-label-ui uppercase tracking-wider"
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
                        class="transition-colors cursor-pointer group/child {isMemberSelected ? 'bg-secondary/20 font-semibold' : 'bg-surface-container-lowest hover:bg-surface-container-high/40'} border-l-4 border-l-secondary/60"
                        data-job-id={memberJob.id}
                        onclick={() => inspectJob(memberJob.id)}
                      >
                        <!-- Sub-status -->
                        <td class="py-2 px-space-sm pl-4">
                          <div class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[14px] text-secondary/70">
                              subdirectory_arrow_right
                            </span>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-code-sm text-[10px] uppercase font-mono {memberJob.status === 'scheduled' ? 'bg-tertiary/10 text-tertiary' : memberJob.status === 'done' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}">
                              <span class="h-1.5 w-1.5 rounded-full {memberJob.status === 'scheduled' ? 'bg-tertiary' : memberJob.status === 'done' ? 'bg-primary' : 'bg-error'}"></span>
                              {formatStatus(memberJob.status)}
                            </span>
                          </div>
                        </td>

                        <!-- Sub-destinatário -->
                        <td class="py-2 px-space-sm">
                          <div class="flex items-center gap-1.5 flex-wrap font-mono">
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
                            <span class="text-label-code-sm text-outline">{memberRecipient.targetNumber}</span>
                            {#if memberJob.template_id}
                              <span class="text-outline-variant font-label-code-sm text-label-code-sm">• tpl: {memberJob.template_id}</span>
                            {/if}
                          </div>
                        </td>

                        <!-- Sub-horário -->
                        <td class="py-2 px-space-sm font-mono text-outline text-label-code-sm">
                          {memberJob.next_run_at ? new Date(memberJob.next_run_at).toLocaleTimeString('pt-BR') : memberJob.run_at ? new Date(memberJob.run_at).toLocaleTimeString('pt-BR') : '—'}
                        </td>

                        <!-- Sub-origem -->
                        <td class="py-2 px-space-sm">
                          <span class="text-outline text-[11px] font-mono">membro</span>
                        </td>

                        <!-- Sub-ações individuais -->
                        <td class="py-2 px-space-sm text-right min-w-[195px]" onclick={(e) => e.stopPropagation()}>
                          <div class="flex items-center justify-end gap-1 flex-nowrap">
                            <button
                              class="px-2 py-0.5 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold text-[11px]"
                              onclick={() => handleRun(memberJob.id)}
                              title="Disparar apenas este destinatário"
                              type="button"
                            >
                              Disparar
                            </button>

                            {#if memberJob.source !== 'yaml'}
                              <button
                                class="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-bright text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-all font-semibold text-[11px]"
                                onclick={() => openReschedule(memberJob.id, memberJob.source)}
                                title="Reagendar este destinatário"
                                type="button"
                              >
                                Editar
                              </button>
                              <button
                                class="px-1 py-0.5 rounded bg-error-container/20 text-error hover:bg-error-container hover:text-on-error transition-all"
                                onclick={() => handleCancel(memberJob)}
                                title="Cancelar apenas este destinatário"
                                aria-label="Cancelar Recado"
                                type="button"
                              >
                                <span class="material-symbols-outlined text-[14px]">cancel</span>
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
    </section>

    <!-- WIDGET 3: JOB DETAIL (wdg-job-detail) - 5 cols on Desktop -->
    {#if selectedJob}
      {@const recipient = resolveRecipient(selectedJob)}
      {@const creatorContact = selectedJob.created_by ? contactsByPhone.get(selectedJob.created_by) : null}
      <section class="lg:col-span-5 bg-surface-container-low p-space-md rounded shadow-sm flex flex-col gap-space-md sticky top-20 border border-outline-variant/10" id="wdg-job-detail">
        <div class="flex items-center justify-between pb-space-xs">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-primary text-[20px]">policy</span>
            <div>
              <h3 class="font-headline-sm text-headline-sm text-on-surface">Inspeção do Job</h3>
              <span class="font-label-code-sm text-label-code-sm text-outline font-mono" id="detail-job-id">ID: {selectedJob.id}</span>
            </div>
          </div>
          <div class="flex items-center gap-space-sm" id="detail-source-badge">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-label-ui text-label-ui uppercase tracking-wider {selectedJob.source === 'yaml' ? 'bg-surface-container-highest text-primary-fixed' : 'bg-surface-container-high text-tertiary'}">
              <span class="material-symbols-outlined text-[13px]">{selectedJob.source === 'yaml' ? 'code_blocks' : 'database'}</span>
              {selectedJob.source === 'yaml' ? 'YAML (Imutável)' : 'SQLite'}
            </span>
            <button
              class="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              onclick={() => (selectedJob = null)}
              title="Fechar inspeção (Esc)"
              type="button"
              aria-label="Fechar inspeção"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {#if selectedJob.source === 'yaml'}
          <div class="p-space-sm rounded bg-surface-container-lowest text-on-surface-variant font-body-sm text-body-sm flex items-start gap-space-xs border border-outline-variant/10" id="detail-yaml-warning">
            <span class="material-symbols-outlined text-primary text-[16px] mt-0.5">lock</span>
            <div>
              <span class="font-semibold text-on-surface">Recado Declarativo:</span> Definido em <code class="text-primary font-label-code-sm font-mono">routines.yaml</code>. Alterações devem ser commitadas no arquivo YAML. Tentativas de mutação direta retornam <strong>HTTP 409 Conflict</strong>.
            </div>
          </div>
        {/if}

        <!-- Grid de Metadados -->
        <div class="grid grid-cols-2 gap-space-sm bg-surface-container-lowest p-space-sm rounded border border-outline-variant/10">
          <div>
            <span class="font-label-ui text-label-ui uppercase text-outline block">Título</span>
            <span class="font-body-md text-body-md font-semibold text-on-surface" id="detail-title">{selectedJob.title}</span>
          </div>
          <div>
            <span class="font-label-ui text-label-ui uppercase text-outline block">Status de Fila</span>
            <span class="inline-flex items-center gap-1 font-label-code-sm text-label-code-sm font-mono {selectedJob.status === 'scheduled' ? 'text-tertiary' : selectedJob.status === 'done' ? 'text-primary' : 'text-error'}" id="detail-status">
              <span class="h-1.5 w-1.5 rounded-full {selectedJob.status === 'scheduled' ? 'bg-tertiary' : selectedJob.status === 'done' ? 'bg-primary' : 'bg-error'}"></span>
              {formatStatus(selectedJob.status)}
            </span>
          </div>
          <div class="col-span-2 sm:col-span-1">
            <span class="font-label-ui text-label-ui uppercase text-outline block">Destino (Target)</span>
            <div class="flex items-start justify-between gap-2 mt-0.5">
              <div class="flex flex-col">
                {#if recipient.primaryName}
                  <div class="flex items-center gap-1 flex-wrap">
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded {recipient.contact ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-tertiary'} font-label-code-sm text-label-code-sm font-semibold">
                      <span class="material-symbols-outlined text-[12px]">{recipient.contact ? 'person' : 'bookmark'}</span>
                      <span>{recipient.primaryName}</span>
                    </span>
                    {#if recipient.alias && recipient.contactName && recipient.alias !== recipient.contactName}
                      <span class="text-outline text-label-code-sm font-mono text-[11px]">(alias: {recipient.alias})</span>
                    {/if}
                  </div>
                {/if}
                <span class="font-label-code text-label-code text-on-surface font-mono mt-0.5" id="detail-target">
                  {recipient.targetNumber}
                </span>
              </div>

              {#if recipient.contact}
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-primary/10 hover:bg-primary hover:text-on-primary text-primary font-label-ui text-label-ui uppercase tracking-wider flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                  onclick={() => router.navigate(`/contacts/${recipient.contact!.id}`)}
                  title="Ver perfil completo de {recipient.contact.name}"
                >
                  <span class="material-symbols-outlined text-[14px]">open_in_new</span>
                  <span>Ver Perfil</span>
                </button>
              {/if}
            </div>
          </div>

          <div class="col-span-2 sm:col-span-1">
            <span class="font-label-ui text-label-ui uppercase text-outline block">Criado Por</span>
            <div class="flex items-center gap-1.5 mt-0.5">
              {#if creatorContact}
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-primary hover:underline font-label-code text-label-code font-mono cursor-pointer"
                  onclick={() => router.navigate(`/contacts/${creatorContact.id}`)}
                  title="Ver perfil de {creatorContact.name}"
                >
                  <span class="material-symbols-outlined text-[14px]">person</span>
                  <span>{creatorContact.name} ({selectedJob.created_by})</span>
                </button>
              {:else}
                <span class="font-label-code text-label-code text-on-surface font-mono" id="detail-created-by">
                  {selectedJob.created_by || '—'}
                </span>
              {/if}
            </div>
          </div>
          <div>
            <span class="font-label-ui text-label-ui uppercase text-outline block">Tipo (Kind)</span>
            <span class="font-label-code text-label-code text-secondary font-mono" id="detail-kind">{selectedJob.kind}</span>
          </div>
          <div>
            <span class="font-label-ui text-label-ui uppercase text-outline block">Expressão / Run At</span>
            <span class="font-label-code text-label-code text-on-surface font-mono" id="detail-schedule">{selectedJob.cron_expr || selectedJob.run_at || '—'}</span>
          </div>
        </div>

        <!-- Histórico e Telemetria -->
        <div class="bg-surface-container p-space-sm rounded flex flex-col gap-space-xs font-label-code-sm text-label-code-sm font-mono border border-outline-variant/10">
          <div class="flex items-center justify-between text-outline">
            <span>Última Execução (last_run_at):</span>
            <span class="text-on-surface">{selectedJob.last_run_at ? new Date(selectedJob.last_run_at).toLocaleString('pt-BR') : 'Nunca executado'}</span>
          </div>
          <div class="flex items-center justify-between text-outline">
            <span>Último Status (last_status):</span>
            <span class="text-tertiary font-semibold">{selectedJob.last_status || 'Pendente'}</span>
          </div>
          <div class="flex items-center justify-between text-outline">
            <span>Tentativas (retry_count):</span>
            <span class="text-on-surface">{selectedJob.retry_count} / 3</span>
          </div>
          {#if selectedJob.last_error}
            <div class="flex flex-col gap-1 text-outline pt-1 border-t border-outline-variant/10">
              <span class="text-error font-semibold">Último Erro (last_error):</span>
              <span class="text-error font-label-code-sm text-label-code-sm break-words whitespace-pre-wrap leading-relaxed bg-error-container/10 p-space-xs rounded font-mono" id="detail-last-error">{selectedJob.last_error}</span>
            </div>
          {/if}
        </div>

        <!-- Conteúdo Integral -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="font-label-ui text-label-ui uppercase text-on-surface-variant">Conteúdo Integral (content)</span>
            <span class="font-label-code-sm text-label-code-sm text-outline font-mono">plaintext</span>
          </div>
          <div class="p-space-sm rounded bg-surface-container-lowest text-on-surface font-label-code-sm text-label-code-sm whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto font-mono border border-outline-variant/10" id="detail-content">
            {selectedJob.content || (selectedJob.template_id ? `[Template ID: ${selectedJob.template_id}]` : '(vazio)')}
          </div>
        </div>

        {#if selectedJob.group_id}
          <div class="bg-surface-container p-space-sm rounded flex flex-col gap-space-xs border border-secondary/20" id="detail-group-card">
            <div class="flex items-center justify-between flex-wrap gap-1">
              <div class="flex items-center gap-1.5 text-secondary font-semibold font-body-sm">
                <span class="material-symbols-outlined text-[18px]">group</span>
                <span>Grupo de Envio ({groupMembers.length} destinatários)</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="font-label-ui text-label-ui uppercase text-outline text-[11px]">group_id:</span>
                <span class="font-label-code-sm text-label-code-sm bg-surface-container-lowest text-secondary px-1.5 py-0.5 rounded font-mono font-semibold" id="detail-group-id">{selectedJob.group_id}</span>
              </div>
            </div>

            <p class="font-body-sm text-body-sm text-on-surface-variant">
              Envio coletivo com status e execução individuais por destinatário.
            </p>

            <!-- Ações em Lote do Grupo -->
            <div class="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                class="px-2 py-1 rounded bg-secondary/15 hover:bg-secondary text-secondary hover:text-on-secondary font-label-ui text-label-ui uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer font-semibold"
                id="btn-group-run-all"
                onclick={() => handleRunGroup(selectedJob!.group_id!)}
                title="POST /jobs/group/{selectedJob.group_id}/run"
              >
                <span class="material-symbols-outlined text-[14px]">send</span>
                <span>Disparar Todos</span>
              </button>
              {#if selectedJob.source !== 'yaml'}
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-error-container/20 hover:bg-error-container text-error hover:text-on-error font-label-ui text-label-ui uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                  id="btn-group-cancel-all"
                  onclick={() => handleCancelGroup(selectedJob!.group_id!)}
                  title="POST /jobs/group/{selectedJob.group_id}/cancel"
                >
                  <span class="material-symbols-outlined text-[14px]">cancel</span>
                  <span>Cancelar Grupo</span>
                </button>
              {/if}
            </div>

            <!-- Lista de Membros do Grupo -->
            {#if loadingGroupMembers}
              <div class="py-2 text-center text-outline font-label-code-sm">Carregando membros do grupo...</div>
            {:else if groupMembers.length > 0}
              <div class="flex flex-col gap-1 mt-1 max-h-48 overflow-y-auto">
                {#each groupMembers as member (member.id)}
                  {@const memberRecipient = resolveRecipient(member)}
                  {@const isCurrent = member.id === selectedJob.id}
                  <button
                    type="button"
                    class="flex items-center justify-between p-1.5 rounded transition-all text-left font-mono font-label-code-sm cursor-pointer {isCurrent ? 'bg-secondary/20 border border-secondary/30 text-on-surface' : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant'}"
                    onclick={() => inspectJob(member.id)}
                  >
                    <div class="flex items-center gap-1.5 truncate">
                      <span class="material-symbols-outlined text-[14px] {isCurrent ? 'text-secondary' : 'text-outline'}">
                        {isCurrent ? 'radio_button_checked' : 'radio_button_unchecked'}
                      </span>
                      {#if memberRecipient.primaryName}
                        <span class="font-semibold text-on-surface truncate">{memberRecipient.primaryName}</span>
                        <span class="text-outline text-[11px]">({memberRecipient.targetNumber})</span>
                      {:else}
                        <span class="truncate">{memberRecipient.targetNumber}</span>
                      {/if}
                    </div>

                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-label-code-sm text-[10px] uppercase font-mono shrink-0 {member.status === 'scheduled' ? 'bg-tertiary/10 text-tertiary' : member.status === 'done' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}">
                      <span class="h-1 w-1 rounded-full {member.status === 'scheduled' ? 'bg-tertiary' : member.status === 'done' ? 'bg-primary' : 'bg-error'}"></span>
                      {member.status}
                    </span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Comandos do Operador -->
        <div class="pt-space-xs flex flex-col gap-space-xs border-t border-outline-variant/10">
          <span class="font-label-ui text-label-ui uppercase text-outline">Comandos do Operador</span>
          <div class="grid grid-cols-3 gap-space-xs">
            <button
              class="px-space-sm py-2 rounded bg-primary text-on-primary font-label-ui text-label-ui uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm hover:brightness-110 active:brightness-95 transition-all font-semibold"
              id="btn-detail-run"
              onclick={() => handleRun(selectedJob!.id)}
              type="button"
            >
              <span class="material-symbols-outlined text-[16px]">send</span>
              <span>Disparar</span>
            </button>

            {#if selectedJob.source !== 'yaml'}
              <button
                class="px-space-sm py-2 rounded bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-ui text-label-ui uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                id="btn-detail-reschedule"
                onclick={() => openReschedule(selectedJob!.id, selectedJob!.source)}
                type="button"
              >
                <span class="material-symbols-outlined text-[16px]">schedule</span>
                <span>Reagendar</span>
              </button>
              <button
                class="px-space-sm py-2 rounded bg-error-container/20 hover:bg-error-container text-error hover:text-on-error font-label-ui text-label-ui uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                id="btn-detail-cancel"
                onclick={() => handleCancel(selectedJob!)}
                type="button"
              >
                <span class="material-symbols-outlined text-[16px]">delete</span>
                <span>Cancelar</span>
              </button>
            {:else}
              <div class="col-span-2 flex items-center justify-center p-2 rounded bg-surface-container text-outline font-label-code-sm">
                Imutável via API (YAML)
              </div>
            {/if}
          </div>
        </div>
      </section>
    {/if}
  </div>

  <!-- WIDGET 4: FORMULÁRIO DE AGENDAMENTO AVULSO (wdg-job-create) [MODAL OVERLAY] -->
  {#if createModalOpen}
    <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-space-md" id="modal-job-create">
      <section
        use:focusTrap
        class="bg-surface-container-low max-w-2xl w-full rounded shadow-xl p-space-lg flex flex-col max-h-[90vh] overflow-y-auto border border-outline-variant/30"
        id="wdg-job-create"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        <div class="flex items-center justify-between pb-space-sm mb-space-md border-b border-outline-variant/10">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-primary text-[22px]">add_circle</span>
            <div>
              <h2 class="font-headline-sm text-headline-sm text-on-surface">Agendamento de Novo Recado</h2>
              <span class="font-label-code-sm text-label-code-sm text-outline font-mono">POST /jobs (SQLite storage)</span>
            </div>
          </div>
          <button class="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container" onclick={() => (createModalOpen = false)} type="button">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form class="flex flex-col gap-space-md" id="form-job-create" onsubmit={handleCreateJob}>
          <!-- Título -->
          <div class="flex flex-col gap-1">
            <label class="font-label-ui text-label-ui uppercase text-on-surface-variant font-semibold" for="create-title">
              Título do Recado <span class="text-primary">*</span>
            </label>
            <input
              class="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded px-space-sm py-2 placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary"
              id="create-title"
              name="title"
              placeholder="Ex: Alerta de Reinicialização de Container"
              required
              type="text"
              bind:value={createTitle}
              oninvalid={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('Informe o título do recado.')}
              oninput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('')}
            />
          </div>

          <!-- Kind & Execução -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md p-space-sm bg-surface-container rounded border border-outline-variant/10">
            <div class="flex flex-col gap-1">
              <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="create-kind">Tipo de Frequência (kind)</label>
              <select
                class="w-full bg-surface-container-lowest text-on-surface font-label-code text-label-code rounded px-space-sm py-2 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                id="create-kind"
                name="kind"
                bind:value={createKind}
              >
                <option value="once">Único (Data/Hora fixa)</option>
                <option value="cron">Recorrente (Cron 5 campos)</option>
              </select>
            </div>

            {#if createKind === 'once'}
              <div class="flex flex-col gap-1" id="field-run-at-container">
                <label class="font-label-ui text-label-ui uppercase text-on-surface-variant font-semibold" for="create-run-at">
                  Data e Hora (run_at) <span class="text-primary">*</span>
                </label>
                <input
                  class="w-full bg-surface-container-lowest text-on-surface font-label-code-sm text-label-code-sm rounded px-space-sm py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  id="create-run-at"
                  name="run_at"
                  type="datetime-local"
                  required
                  bind:value={createRunAt}
                  oninvalid={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('Informe a data e hora para execução única.')}
                  oninput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('')}
                />
              </div>
            {:else}
              <div class="flex flex-col gap-1" id="field-cron-container">
                <label class="font-label-ui text-label-ui uppercase text-on-surface-variant font-semibold" for="create-cron-expr">
                  Expressão Cron de 5 Campos <span class="text-primary">*</span>
                </label>
                <input
                  class="w-full bg-surface-container-lowest text-primary font-label-code text-label-code rounded px-space-sm py-2 placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  id="create-cron-expr"
                  name="cron_expr"
                  placeholder="0 8 * * 1-5"
                  required
                  type="text"
                  bind:value={createCronExpr}
                  oninvalid={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('Informe a expressão cron de 5 campos.')}
                  oninput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('')}
                />
                <span class="font-label-code-sm text-label-code-sm text-outline">Formato: minuto hora dia mês dia_semana</span>
              </div>
            {/if}
          </div>

          <!-- Destinatários (to / batch) e Criador (created_by) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="input-add-recipient">
                  Destinatários <span class="text-primary">*</span>
                </label>
                <button
                  class="font-label-code-sm text-label-code-sm text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                  onclick={() => triggerContactPicker('to')}
                  type="button"
                >
                  <span class="material-symbols-outlined text-[14px]">contacts</span>
                  <span>Adicionar Contato</span>
                </button>
              </div>

              <!-- Chips de Destinatários Selecionados -->
              <div class="flex flex-wrap gap-1.5 p-1.5 rounded bg-surface-container-lowest min-h-[42px] border border-outline-variant/20 items-center">
                {#if createRecipients.length === 0}
                  <span class="text-outline text-label-code-sm font-mono px-1">Nenhum destinatário selecionado</span>
                {:else}
                  {#each createRecipients as rec, idx (rec)}
                    {@const c = contactsByPhone.get(rec)}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-label-code-sm">
                      <span class="material-symbols-outlined text-[12px]">{c ? 'person' : 'phone'}</span>
                      <span class="font-semibold">{c ? c.name : rec}</span>
                      {#if c && c.phone !== rec}
                        <span class="text-outline text-[10px]">({rec})</span>
                      {/if}
                      <button
                        type="button"
                        class="hover:text-error ml-0.5 cursor-pointer flex items-center"
                        title="Remover"
                        onclick={() => removeRecipient(idx)}
                      >
                        <span class="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </span>
                  {/each}
                {/if}
              </div>

              <!-- Input para adicionar novo destinatário -->
              <div class="flex items-center gap-1">
                <input
                  class="flex-1 bg-surface-container-lowest text-on-surface font-label-code text-label-code rounded px-space-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  id="input-add-recipient"
                  placeholder="Número, alias ou 'eu'..."
                  type="text"
                  bind:value={recipientInput}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                />
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded bg-surface-container-high hover:bg-surface-bright text-primary font-label-ui text-label-ui uppercase tracking-wider font-semibold cursor-pointer"
                  onclick={() => addRecipient()}
                >
                  Adicionar
                </button>
              </div>

              {#if createRecipients.length > 1}
                <div class="flex items-center gap-1.5 text-secondary font-label-code-sm font-mono">
                  <span class="material-symbols-outlined text-[14px]">group</span>
                  <span>Envio em grupo: {createRecipients.length} agendamentos com group_id unificado.</span>
                </div>
              {:else}
                <span class="font-body-sm text-body-sm text-outline">Padrão da API: "eu" ou número E.164 (+55...)</span>
              {/if}
            </div>

            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="create-created-by">
                  Criado Por (created_by)
                </label>
                <button
                  class="font-label-code-sm text-label-code-sm text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                  onclick={() => triggerContactPicker('created_by')}
                  type="button"
                >
                  <span class="material-symbols-outlined text-[14px]">contacts</span>
                  <span>Preencher</span>
                </button>
              </div>
              <input
                class="w-full bg-surface-container-lowest text-on-surface font-label-code text-label-code rounded px-space-sm py-2 placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                id="create-created-by"
                name="created_by"
                placeholder="ex: sysadmin ou telefone"
                type="text"
                bind:value={createCreatedBy}
              />
            </div>
          </div>

          <!-- XOR PAYLOAD: content XOR template_id -->
          <div class="flex flex-col gap-space-xs p-space-sm bg-surface-container-lowest rounded border border-outline-variant/10">
            <div class="flex items-center justify-between">
              <span class="font-label-ui text-label-ui uppercase text-on-surface-variant font-semibold">
                Payload: Mensagem Direta OU Modelo
              </span>
              <div class="flex items-center gap-space-xs font-label-code-sm text-label-code-sm">
                <label class="flex items-center gap-1 cursor-pointer">
                  <input
                    checked={createPayloadMode === 'direct'}
                    class="text-primary"
                    name="payload_mode"
                    onchange={() => (createPayloadMode = 'direct')}
                    type="radio"
                    value="direct"
                  />
                  <span>Texto Direto</span>
                </label>
                <label class="flex items-center gap-1 cursor-pointer">
                  <input
                    checked={createPayloadMode === 'template'}
                    class="text-primary"
                    name="payload_mode"
                    onchange={() => (createPayloadMode = 'template')}
                    type="radio"
                    value="template"
                  />
                  <span>Template ID</span>
                </label>
              </div>
            </div>

            {#if createPayloadMode === 'direct'}
              <div class="flex flex-col gap-1" id="field-direct-content">
                <textarea
                  class="w-full bg-surface-container text-on-surface font-body-md text-body-md rounded p-space-sm placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary"
                  id="create-content"
                  name="content"
                  placeholder="Digite o recado completo a ser transmitido pelo despachante..."
                  rows="3"
                  bind:value={createContent}
                ></textarea>
              </div>
            {:else}
              <div class="flex flex-col gap-1" id="field-template-id">
                <select
                  class="w-full bg-surface-container text-on-surface font-label-code text-label-code rounded px-space-sm py-2 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  id="create-template-id"
                  name="template_id"
                  bind:value={createTemplateId}
                >
                  <option value="">-- Escolha um modelo registrado --</option>
                  {#each templates as tpl}
                    <option value={tpl.id}>{tpl.id}: {tpl.name}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>

          <div class="flex items-center justify-end gap-space-sm pt-space-xs border-t border-outline-variant/10">
            <button
              class="px-space-md py-2 rounded bg-surface-container hover:bg-surface-bright text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-all cursor-pointer"
              onclick={() => (createModalOpen = false)}
              type="button"
            >
              Cancelar
            </button>
            <button
              class="px-space-md py-2 rounded bg-primary text-on-primary font-label-ui text-label-ui uppercase tracking-wider shadow-sm hover:brightness-110 active:brightness-95 transition-all flex items-center gap-1 font-semibold cursor-pointer"
              type="submit"
              disabled={creatingJob}
            >
              <span class="material-symbols-outlined text-[16px]">save</span>
              <span>{creatingJob ? 'Gravando...' : 'Registrar na Agenda'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  {/if}
</div>

<!-- AUX MODALS -->
<RescheduleModal
  open={rescheduleModalOpen}
  jobId={rescheduleJobId}
  onclose={() => (rescheduleModalOpen = false)}
  onsuccess={() => loadJobs()}
/>

<ContactPickerModal
  open={contactPickerOpen}
  onselect={onContactPicked}
  onclose={() => (contactPickerOpen = false)}
/>
