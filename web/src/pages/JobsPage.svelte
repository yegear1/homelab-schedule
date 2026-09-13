<script lang="ts">
  import { api, ApiClientError } from '../lib/api';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import type { Contact, Job, JobListItem, JobListFilter, JobKind, MessageTemplate } from '../lib/types';
  import RescheduleModal from '../components/RescheduleModal.svelte';
  import ContactPickerModal from '../components/ContactPickerModal.svelte';

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

  // Create Job Modal State (wdg-job-create)
  let createModalOpen = $state(false);
  let createTitle = $state('');
  let createKind = $state<JobKind>('once');
  let createRunAt = $state('');
  let createCronExpr = $state('');
  let createTo = $state('eu');
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

    const alias = job.to && job.to !== target && job.to !== job.target_number ? job.to : null;
    const contactName = contact?.name || null;
    const primaryName = alias || contactName;

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
    } catch (err: unknown) {
      toast.error('Falha ao carregar detalhe do job.');
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
    if (!confirm(`Confirma cancelamento do recado [${jobItem.id}]?`)) return;

    try {
      await api.cancelJob(jobItem.id);
      toast.success(`Recado ${jobItem.id} cancelado.`);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cancelar';
      toast.error(msg);
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

  function onContactPicked(phoneOrAlias: string, _name: string) {
    if (contactPickerTargetField === 'to') {
      createTo = phoneOrAlias;
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
      await api.createJob({
        title: createTitle.trim(),
        to: createTo.trim() || 'eu',
        kind: createKind,
        run_at: createKind === 'once' && createRunAt ? new Date(createRunAt).toISOString() : null,
        cron_expr: createKind === 'cron' ? createCronExpr.trim() : null,
        content: payloadContent,
        template_id: payloadTemplateId,
        created_by: createCreatedBy.trim() || null,
      });

      toast.success(`Job "${createTitle}" registrado na agenda.`);
      createModalOpen = false;
      createTitle = '';
      createContent = '';
      createTemplateId = '';
      createRunAt = '';
      createCronExpr = '';
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
          <option value="upcoming">upcoming (Agendados)</option>
          <option value="all">all (Todos)</option>
          <option value="done">done (Concluídos)</option>
          <option value="paused">paused (Pausados)</option>
          <option value="error">error (Falhas)</option>
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
        <div class="flex items-center gap-space-xs font-label-code-sm text-label-code-sm text-on-surface-variant font-mono">
          <span>Total:</span>
          <span class="font-semibold text-primary" id="list-count-badge">{jobs.length} itens</span>
        </div>
      </div>

      <!-- Tabela Estruturada de Recados -->
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left font-body-sm text-body-sm text-on-surface">
          <thead>
            <tr class="bg-surface-container-lowest text-on-surface-variant font-label-ui text-label-ui uppercase tracking-wider border-b border-outline-variant/10">
              <th class="py-2.5 px-space-sm">Status</th>
              <th class="py-2.5 px-space-sm">Título &amp; Destino</th>
              <th class="py-2.5 px-space-sm">Tipo / Próx. Execução</th>
              <th class="py-2.5 px-space-sm">Origem</th>
              <th class="py-2.5 px-space-sm text-right">Ações</th>
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
              {#each jobs as job (job.id)}
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
                      {job.status}
                    </span>
                  </td>

                  <td class="py-2.5 px-space-sm">
                    <div class="font-body-md text-body-md font-semibold text-on-surface group-hover:text-primary transition-colors">
                      {job.title}
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
                      {job.kind === 'cron' ? `cron: ${job.cron_expr}` : 'once'}
                    </div>
                    <div class="text-on-surface-variant font-label-code-sm text-label-code-sm mt-0.5">
                      {job.next_run_at ? new Date(job.next_run_at).toLocaleString('pt-BR') : job.run_at ? new Date(job.run_at).toLocaleString('pt-BR') : '—'}
                    </div>
                  </td>

                  <td class="py-2.5 px-space-sm">
                    <div class="flex flex-col items-start gap-1">
                      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-ui text-label-ui uppercase tracking-wider {job.source === 'yaml' ? 'bg-surface-container-highest text-primary-fixed' : 'bg-surface-container-high text-tertiary'}">
                        <span class="material-symbols-outlined text-[12px]">{job.source === 'yaml' ? 'code_blocks' : 'database'}</span>
                        {job.source}
                      </span>
                      {#if job.source === 'yaml'}
                        <span class="font-label-code-sm text-[10px] text-outline font-mono">HTTP 409 locked</span>
                      {/if}
                    </div>
                  </td>

                  <td class="py-2.5 px-space-sm text-right" onclick={(e) => e.stopPropagation()}>
                    <div class="flex items-center justify-end gap-1">
                      <button
                        class="px-2 py-1 rounded bg-surface-container-lowest hover:bg-primary hover:text-on-primary text-primary font-label-ui text-label-ui uppercase tracking-wider transition-all"
                        onclick={() => handleRun(job.id)}
                        title="POST /jobs/{job.id}/run"
                        type="button"
                      >
                        Disparar
                      </button>

                      {#if job.source !== 'yaml'}
                        <button
                          class="px-2 py-1 rounded bg-surface-container-lowest hover:bg-surface-bright text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-all"
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
                          type="button"
                        >
                          <span class="material-symbols-outlined text-[16px]">cancel</span>
                        </button>
                      {:else}
                        <button
                          class="px-2 py-1 rounded bg-surface-container-lowest text-outline-variant opacity-40 font-label-ui text-label-ui uppercase tracking-wider cursor-not-allowed"
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
          <div id="detail-source-badge">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-label-ui text-label-ui uppercase tracking-wider {selectedJob.source === 'yaml' ? 'bg-surface-container-highest text-primary-fixed' : 'bg-surface-container-high text-tertiary'}">
              <span class="material-symbols-outlined text-[13px]">{selectedJob.source === 'yaml' ? 'code_blocks' : 'database'}</span>
              {selectedJob.source === 'yaml' ? 'YAML (Imutável)' : 'SQLite'}
            </span>
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
              {selectedJob.status}
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
            <div class="flex items-start justify-between text-outline pt-1">
              <span>Último Erro (last_error):</span>
              <span class="text-error font-label-code-sm text-label-code-sm max-w-[200px] text-right truncate">{selectedJob.last_error}</span>
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
      <section class="bg-surface-container-low max-w-2xl w-full rounded shadow-xl p-space-lg flex flex-col max-h-[90vh] overflow-y-auto border border-outline-variant/30" id="wdg-job-create">
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
            <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="create-title">
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
                <option value="once">once (Data/Hora fixa única)</option>
                <option value="cron">cron (Recorrência programada)</option>
              </select>
            </div>

            {#if createKind === 'once'}
              <div class="flex flex-col gap-1" id="field-run-at-container">
                <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="create-run-at">
                  Data e Hora (run_at) <span class="text-primary">*</span>
                </label>
                <input
                  class="w-full bg-surface-container-lowest text-on-surface font-label-code-sm text-label-code-sm rounded px-space-sm py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  id="create-run-at"
                  name="run_at"
                  type="datetime-local"
                  required
                  bind:value={createRunAt}
                />
              </div>
            {:else}
              <div class="flex flex-col gap-1" id="field-cron-container">
                <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="create-cron-expr">
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
                />
                <span class="font-label-code-sm text-label-code-sm text-outline">Formato: minuto hora dia mês dia_semana</span>
              </div>
            {/if}
          </div>

          <!-- Destinatário (to) e Criador (created_by) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="create-to">
                  Destinatário (to) <span class="text-primary">*</span>
                </label>
                <button
                  class="font-label-code-sm text-label-code-sm text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                  onclick={() => triggerContactPicker('to')}
                  type="button"
                >
                  <span class="material-symbols-outlined text-[14px]">contacts</span>
                  <span>Selecionar Contato</span>
                </button>
              </div>
              <input
                class="w-full bg-surface-container-lowest text-on-surface font-label-code text-label-code rounded px-space-sm py-2 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                id="create-to"
                name="to"
                required
                type="text"
                bind:value={createTo}
              />
              <span class="font-body-sm text-body-sm text-outline">Padrão da API: "eu" ou número E.164 (+55...)</span>
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
