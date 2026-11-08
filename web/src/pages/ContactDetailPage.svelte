<script lang="ts">
  import { api, ApiClientError } from '../lib/api';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import type { Contact, JobListItem, Job, JobListFilter } from '../lib/types';
  import JobInspector from '../components/jobs/JobInspector.svelte';
  import JobComposer from '../components/jobs/JobComposer.svelte';
  import RescheduleModal from '../components/RescheduleModal.svelte';

  const contactId = $derived(router.params.contactId || '');

  let contact = $state<Contact | null>(null);
  let jobs = $state<JobListItem[]>([]);
  let selectedId = $state<string | null>(null);
  let detailRevision = $state(0);
  const selectedJob = $derived(jobs.find(job => job.id === selectedId) ?? null);

  let loading = $state(true);
  let jobsLoading = $state(false);
  let errorMsg = $state<string | null>(null);

  // Filter jobs
  let filterStatus = $state<JobListFilter>('upcoming');

  // Edit contact form
  let editName = $state('');
  let editPhone = $state('');
  let savingContact = $state(false);

  // Reschedule modal
  let rescheduleModalOpen = $state(false);
  let rescheduleTargetJobId = $state('');

  $effect(() => {
    if (contactId) {
      loadContactData();
    }
  });

  async function loadContactData() {
    selectedId = null;
    loading = true;
    errorMsg = null;
    try {
      contact = await api.getContact(contactId);
      editName = contact.name;
      editPhone = contact.phone;
      await loadJobsForContact(contact.phone);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 404) {
        errorMsg = 'Contato não encontrado no banco SQLite.';
      } else {
        errorMsg = err instanceof Error ? err.message : 'Falha ao carregar contato';
      }
    } finally {
      loading = false;
    }
  }

  async function loadJobsForContact(phone: string, statusOverride?: JobListFilter) {
    jobsLoading = true;
    const status = statusOverride ?? filterStatus;
    try {
      jobs = await api.getJobs({ status, phone });
      detailRevision++;
    } catch (err: unknown) {
      toast.error('Falha ao carregar recados do contato.');
    } finally {
      jobsLoading = false;
    }
  }

  function changeFilter(status: JobListFilter) {
    filterStatus = status;
    if (contact) {
      loadJobsForContact(contact.phone, status);
    }
  }

  function inspectJob(jobId: string): void {
    selectedId = jobId;
  }

  async function handlePatchContact(e: SubmitEvent) {
    e.preventDefault();
    if (!contact) return;
    savingContact = true;
    try {
      const payload: { name?: string; phone?: string } = {};
      if (editName.trim() !== contact.name) payload.name = editName.trim();
      if (editPhone.trim() !== contact.phone) payload.phone = editPhone.trim();

      if (Object.keys(payload).length === 0) {
        toast.info('Nenhuma alteração detectada.');
        savingContact = false;
        return;
      }

      const updated = await api.patchContact(contact.id, payload);
      const phoneChanged = updated.phone !== contact.phone;
      contact = updated;
      toast.success('Contato atualizado com sucesso.');

      if (phoneChanged) {
        await loadJobsForContact(updated.phone);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar contato';
      toast.error(msg);
    } finally {
      savingContact = false;
    }
  }

  async function handleDeleteContact() {
    if (!contact) return;
    const confirmed = confirm(
      `Atenção: A exclusão falhará com erro 409 se houver agendamentos "scheduled" pendentes para este número.\n\nDeseja prosseguir com a exclusão de "${contact.name}"?`
    );
    if (!confirmed) return;

    try {
      await api.deleteContact(contact.id);
      toast.success(`Contato ${contact.name} excluído.`);
      router.navigate('/contacts');
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 409) {
        toast.error('HTTP 409 Conflict: Contato possui jobs com status "scheduled". Cancele-os primeiro.');
      } else {
        const msg = err instanceof Error ? err.message : 'Falha ao excluir contato';
        toast.error(msg);
      }
    }
  }

  const pendingActions = $state(new Set<string>());

  async function handleRunJob(jobId: string) {
    if (pendingActions.has(jobId)) return;
    pendingActions.add(jobId);
    try {
      const res = await api.runJob(jobId);
      toast.queued(`POST /jobs/${jobId}/run: 202 Enfileirado no gateway (${res.status})`);
      if (contact) await loadJobsForContact(contact.phone);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao disparar recado';
      toast.error(msg);
    } finally {
      pendingActions.delete(jobId);
    }
  }

  async function handleCancelJob(jobItem: JobListItem | Job) {
    if (jobItem.source === 'yaml') {
      toast.error('Erro 409: Jobs de routines.yaml não podem ser cancelados via API.');
      return;
    }

    if (pendingActions.has(jobItem.id)) return;
    pendingActions.add(jobItem.id);
    try {
      await api.cancelJob(jobItem.id);
      toast.success(`Recado ${jobItem.id} cancelado com sucesso.`);
      if (contact) await loadJobsForContact(contact.phone);
      if (selectedJob?.id === jobItem.id) {
        await inspectJob(jobItem.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cancelar recado';
      toast.error(msg);
    } finally {
      pendingActions.delete(jobItem.id);
    }
  }

  function openReschedule(jobId: string, source: string) {
    if (source === 'yaml') {
      toast.error('Erro 409: Jobs de routines.yaml não podem ser reagendados via API.');
      return;
    }
    rescheduleTargetJobId = jobId;
    rescheduleModalOpen = true;
  }

</script>

<div class="support-page flex flex-col w-full" data-state={loading ? 'loading' : errorMsg ? 'error' : 'ready'} id="scr-contact">
  <!-- Top Bar & Breadcrumb Navigation -->
  <div class="flex items-center justify-between pb-space-md mb-space-md border-b border-separator/60">
    <nav aria-label="Navegação estrutural" class="flex flex-wrap items-center gap-space-sm">
      <a class="inline-flex items-center gap-space-xs font-label-ui text-label-ui uppercase tracking-wider text-accent hover:text-accent transition-colors duration-selection ease-fluid" href="/contacts">
        <span aria-hidden="true" class="material-symbols-outlined text-[16px]">arrow_back</span>
        <span>Voltar para Contatos</span>
      </a>
      <span class="text-secondary-label text-label-code-sm">/</span>
      <span class="font-label-code-sm text-label-code-sm text-secondary-label font-mono">UID: {contactId}</span>
    </nav>
    <div class="flex items-center gap-space-sm">
      <span class="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-xl bg-tertiary/10 text-tertiary font-label-code-sm text-label-code-sm">
        <span class="h-1.5 w-1.5 rounded-full bg-tertiary"></span>
        <span>REGISTRO VÁLIDO</span>
      </span>
      <span class="font-label-code-sm text-label-code-sm text-secondary-label font-mono">NODE_HASH: 0x8F3A21C</span>
    </div>
  </div>

  {#if loading}
    <div class="p-space-xl text-center flex flex-col items-center justify-center gap-space-xs text-secondary-label font-label-code-sm">
      <span aria-hidden="true" class="material-symbols-outlined text-accent text-[32px] animate-spin">sync</span>
      <span>Carregando ficha do contato...</span>
    </div>
  {:else if errorMsg}
    <div class="p-space-xl text-center flex flex-col items-center justify-center gap-space-md bg-secondary-system-background rounded-xl border border-separator/60">
      <span aria-hidden="true" class="material-symbols-outlined text-error text-[40px]">person_off</span>
      <span class="font-headline-sm text-label">{errorMsg}</span>
      <a class="px-space-md py-space-sm bg-accent text-on-primary rounded-xl font-label-ui text-label-ui uppercase" href="/contacts">
        Voltar para Lista
      </a>
    </div>
  {:else if contact}
    <!-- wdg-contact-header: Perfil do Contato & Ações Primárias -->
    <section class="support-panel bg-secondary-system-background rounded-xl p-space-lg mb-space-lg shadow-sm border border-separator/60" id="wdg-contact-header">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-lg">
        <div class="flex items-start sm:items-center gap-space-md min-w-0">
          <div class="relative shrink-0 w-14 h-14 rounded-full bg-fill flex items-center justify-center">
            <span aria-hidden="true" class="material-symbols-outlined text-accent text-[28px]">contact_phone</span>
            <span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-tertiary ring-2 ring-secondary-system-background"></span>
          </div>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-space-sm flex-wrap">
              <h1 class="font-headline-md text-headline-md text-label tracking-tight truncate">{contact.name}</h1>
              <span class="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-xl bg-tertiary-container/20 text-tertiary font-label-ui text-label-ui uppercase tracking-wider">
                <span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                Ativo no sistema
              </span>
              <span class="font-label-code-sm text-label-code-sm text-secondary-label font-mono">ID: {contact.id}</span>
            </div>
            <div class="flex items-center gap-space-md mt-1 flex-wrap font-label-code text-label-code text-secondary-label font-mono">
              <span class="flex items-center gap-1 text-accent">
                <span aria-hidden="true" class="material-symbols-outlined text-[14px]">call</span>
                {contact.phone}
              </span>
              <span class="text-secondary-label">|</span>
              <span class="flex items-center gap-1 text-secondary-label">
                <span aria-hidden="true" class="material-symbols-outlined text-[14px]">dns</span>
                Origem: sqlite_wal
              </span>
            </div>
          </div>
        </div>

        <!-- Ação Destrutiva com Guardrail -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-space-md shrink-0">
          <div class="max-w-xs text-right sm:text-right hidden sm:block">
            <p class="font-label-code-sm text-label-code-sm text-error/90 flex items-center gap-1 justify-end font-mono">
              <span aria-hidden="true" class="material-symbols-outlined text-[14px]">warning</span>
              Prevenção 409 Ativa
            </p>
            <p class="font-label-code-sm text-label-code-sm text-secondary-label">Bloqueado se houver job 'scheduled' para este número.</p>
          </div>
          <button
            class="px-space-md py-space-sm rounded-xl bg-error-container/40 hover:bg-error-container text-error hover:text-on-error-container font-label-ui text-label-ui uppercase tracking-wider transition-colors duration-selection ease-fluid flex items-center gap-space-xs shadow-sm"
            id="btn-delete-contact"
            onclick={handleDeleteContact}
            type="button"
          >
            <span aria-hidden="true" class="material-symbols-outlined text-[16px]">delete_forever</span>
            <span>Excluir Contato</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Layout Principal: Coluna Esquerda (Edição + Agendador) & Coluna Direita (Jobs List + Drawer) -->
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
      <!-- Coluna Esquerda (5 Colunas) -->
      <div class="xl:col-span-5 flex flex-col gap-space-lg">
        <!-- wdg-contact-edit: Edição de Contato PATCH -->
        <div class="support-panel bg-secondary-system-background rounded-xl p-space-lg shadow-sm border border-separator/60" id="wdg-contact-edit">
          <div class="flex items-center justify-between pb-space-sm mb-space-md">
            <div class="flex items-center gap-space-xs">
              <span aria-hidden="true" class="material-symbols-outlined text-accent text-[18px]">edit_note</span>
              <h2 class="font-headline-sm text-headline-sm text-label">Atualizar Contato</h2>
            </div>
            <span class="font-label-code-sm text-label-code-sm text-accent font-mono">PATCH /contacts/{contact.id}</span>
          </div>

          <form class="flex flex-col gap-space-md" id="form-edit-contact" onsubmit={handlePatchContact}>
            <div class="flex flex-col gap-1">
              <label class="font-label-ui text-label-ui uppercase tracking-wider text-secondary-label" for="input-edit-name">
                Nome Completo
              </label>
              <input
                class="bg-system-background text-label rounded-xl px-space-md py-space-sm font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-selection ease-fluid"
                id="input-edit-name"
                name="name"
                type="text"
                bind:value={editName}
              />
              <span class="font-body-sm text-body-sm text-secondary-label">Opcional. Deixe intacto se desejar manter.</span>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-label-ui text-label-ui uppercase tracking-wider text-secondary-label" for="input-edit-phone">
                Telefone E.164
              </label>
              <input
                class="bg-system-background text-label rounded-xl px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-selection ease-fluid font-mono"
                id="input-edit-phone"
                name="phone"
                type="text"
                bind:value={editPhone}
              />
              <span class="font-body-sm text-body-sm text-secondary-label">Aceita formato internacional com DDI (+55...).</span>
            </div>

            <div class="bg-fill/60 rounded-xl p-space-sm flex items-start gap-space-xs">
              <span aria-hidden="true" class="material-symbols-outlined text-accent text-[16px] shrink-0 mt-0.5">sync_alt</span>
              <p class="font-body-sm text-body-sm text-secondary-label">
                <strong class="text-label font-medium">Alerta de sincronização:</strong> Ao alterar o telefone, a lista de recados será recarregada com o novo número.
              </p>
            </div>

            <div class="flex items-center justify-end gap-space-sm pt-space-xs">
              <button
                class="px-space-md py-space-sm rounded-xl bg-tertiary-system-background text-secondary-label hover:text-label font-label-ui text-label-ui uppercase tracking-wider transition-colors duration-selection ease-fluid"
                onclick={() => {
                  if (contact) {
                    editName = contact.name;
                    editPhone = contact.phone;
                  }
                }}
                type="button"
              >
                Descartar
              </button>
              <button
                class="px-space-lg py-space-sm rounded-xl bg-accent hover:bg-accent/90 text-on-primary font-label-ui text-label-ui uppercase tracking-wider transition-colors duration-selection ease-fluid flex items-center gap-space-xs shadow-sm font-semibold"
                type="submit"
                disabled={savingContact}
              >
                <span aria-hidden="true" class="material-symbols-outlined text-[16px]">save</span>
                <span>{savingContact ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        </div>

        {#key contact.phone}
          <JobComposer inline recipient={contact.phone} createdBy={contact.phone} oncreated={async () => { if (contact) await loadJobsForContact(contact.phone); }} />
        {/key}
      </div>

      <!-- Coluna Direita (7 Colunas): wdg-job-list & wdg-job-detail -->
      <div class="xl:col-span-7 flex flex-col gap-space-lg">
        <!-- wdg-job-list: Listagem Unificada de Recados do Contato -->
        <div class="support-panel bg-secondary-system-background rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border border-separator/60" id="wdg-job-list">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm">
            <div>
              <div class="flex items-center gap-space-xs">
                <span aria-hidden="true" class="material-symbols-outlined text-accent text-[20px]">dynamic_feed</span>
                <h2 class="font-headline-sm text-headline-sm text-label">Recados Vinculados</h2>
                <span class="px-space-xs py-0.5 rounded-xl bg-fill text-label font-label-code-sm text-label-code-sm font-mono">
                  {jobs.length}
                </span>
              </div>
              <p class="font-label-code-sm text-label-code-sm text-secondary-label font-mono mt-0.5">
                GET /jobs?status={filterStatus}&amp;phone={contact.phone}
              </p>
            </div>

            <!-- Filtros / legend badges -->
            <div class="flex items-center gap-space-xs text-label-code-sm font-mono">
              <span class="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-xl bg-primary-container/20 text-accent">
                <span class="w-1.5 h-1.5 rounded-full bg-accent"></span> Destino
              </span>
              <span class="inline-flex items-center gap-1 px-space-xs py-0.5 rounded-xl bg-secondary-container/30 text-on-secondary-container">
                <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span> Criador
              </span>
            </div>
          </div>

          <!-- Status Filter Tabs -->
          <div class="support-tabs flex items-center gap-1 p-1 bg-system-background rounded-xl overflow-x-auto">
            <button
              class="px-space-sm py-1 rounded-xl font-label-ui text-label-ui uppercase tracking-wider transition-colors duration-selection ease-fluid {filterStatus === 'upcoming' ? 'bg-fill text-accent font-bold shadow-sm' : 'text-secondary-label hover:text-label'}"
              aria-pressed={filterStatus === 'upcoming'}
                  onclick={() => changeFilter('upcoming')}
              type="button"
            >
              Ativos (upcoming)
            </button>
            <button
              class="px-space-sm py-1 rounded-xl font-label-ui text-label-ui uppercase tracking-wider transition-colors duration-selection ease-fluid {filterStatus === 'all' ? 'bg-fill text-accent font-bold shadow-sm' : 'text-secondary-label hover:text-label'}"
              aria-pressed={filterStatus === 'all'}
                  onclick={() => changeFilter('all')}
              type="button"
            >
              Todos (all)
            </button>
            <button
              class="px-space-sm py-1 rounded-xl font-label-ui text-label-ui uppercase tracking-wider transition-colors duration-selection ease-fluid {filterStatus === 'paused' ? 'bg-fill text-accent font-bold shadow-sm' : 'text-secondary-label hover:text-label'}"
              aria-pressed={filterStatus === 'paused'}
                  onclick={() => changeFilter('paused')}
              type="button"
            >
              Cancelados / Pausados
            </button>
            <button
              class="px-space-sm py-1 rounded-xl font-label-ui text-label-ui uppercase tracking-wider transition-colors duration-selection ease-fluid {filterStatus === 'done' ? 'bg-fill text-accent font-bold shadow-sm' : 'text-secondary-label hover:text-label'}"
              aria-pressed={filterStatus === 'done'}
                  onclick={() => changeFilter('done')}
              type="button"
            >
              Concluídos
            </button>
          </div>

          <!-- Lista de Jobs -->
          <div class="flex flex-col gap-space-sm">
            {#if jobsLoading}
              <div class="p-space-lg text-center text-secondary-label font-label-code-sm">Atualizando recados...</div>
            {:else if jobs.length === 0}
              <div class="p-space-lg text-center bg-tertiary-system-background rounded-xl text-secondary-label font-body-sm">
                Nenhum recado vinculado a este número no filtro "{filterStatus}".
              </div>
            {:else}
              {#each jobs as job (job.id)}
                {@const isDest = job.target_number === contact.phone || job.to === contact.phone}
                <article
                  class="support-job-card bg-tertiary-system-background rounded-xl p-space-md hover:bg-fill/70 transition-colors duration-selection ease-fluid flex flex-col gap-space-sm shadow-sm {selectedJob?.id === job.id ? 'ring-1 ring-accent' : ''}"
                  id="job-card-{job.id}"
                  aria-current={selectedJob?.id === job.id ? 'true' : undefined}
                  onclick={() => inspectJob(job.id)}
                  role="presentation"
                >
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                    <div class="flex items-center gap-space-xs flex-wrap">
                      <span class="px-space-xs py-0.5 rounded-xl {isDest ? 'bg-primary-container/20 text-accent' : 'bg-secondary-container/40 text-label'} font-label-code-sm text-label-code-sm font-semibold uppercase">
                        {isDest ? 'Para este contato' : 'Criado por este contato'}
                      </span>
                      <span class="font-label-code-sm text-label-code-sm font-mono text-secondary-label">ID: {job.id}</span>
                      <span class="font-label-code-sm text-label-code-sm px-1.5 py-0.5 rounded-xl bg-fill text-tertiary font-mono">{job.kind}</span>
                      <span class="font-label-code-sm text-label-code-sm px-1.5 py-0.5 rounded-xl bg-fill {job.source === 'yaml' ? 'text-accent' : 'text-secondary-label'} font-mono">
                        src: {job.source}
                      </span>
                    </div>

                    <span class="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-xl font-label-code-sm text-label-code-sm uppercase font-mono {job.status === 'scheduled' ? 'bg-accent/10 text-accent' : job.status === 'done' ? 'bg-tertiary/10 text-tertiary' : 'bg-error-container/40 text-error'}">
                      <span class="w-1.5 h-1.5 rounded-full {job.status === 'scheduled' ? 'bg-accent animate-pulse' : job.status === 'done' ? 'bg-tertiary' : 'bg-error'}"></span>
                      {job.status}
                    </span>
                  </div>

                  <div class="flex flex-col">
                    <h3 class="font-headline-sm text-headline-sm text-label"><button class="support-job-title" type="button" onclick={(event) => { event.stopPropagation(); inspectJob(job.id); }}>{job.title}</button></h3>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-space-xs mt-space-xs text-label-code-sm font-mono text-secondary-label">
                      <div>
                        <span class="text-secondary-label">Para:</span>
                        {#if job.to && job.to !== (job.target_number || job.to)}
                          <span class="text-accent font-semibold">{job.to}</span>
                          <span class="text-secondary-label text-xs">({job.target_number || job.to})</span>
                        {:else}
                          <span>{job.target_number || job.to}</span>
                        {/if}
                      </div>
                      <div><span class="text-secondary-label">Por:</span> {job.created_by || '—'}</div>
                      <div><span class="text-secondary-label">Exec:</span> {job.cron_expr || job.run_at || '—'}</div>
                      <div><span class="text-secondary-label">Next:</span> {job.next_run_at ? new Date(job.next_run_at).toLocaleTimeString('pt-BR') : '—'}</div>
                    </div>
                  </div>

                  {#if job.source === 'yaml'}
                    <div class="bg-system-background/80 p-space-xs rounded-xl flex items-center gap-space-xs text-secondary-label font-label-code-sm text-label-code-sm">
                      <span aria-hidden="true" class="material-symbols-outlined text-secondary-label text-[16px]">lock</span>
                      <span>Rotina definida em <code class="text-accent font-mono">routines.yaml</code> (edição/cancelamento via HTTP indisponível - erro 409).</span>
                    </div>
                  {/if}

                  <div role="presentation" class="flex items-center justify-between pt-space-xs" onclick={(e) => e.stopPropagation()}>
                    <div class="flex items-center gap-space-xs">
                      <span class="font-label-code-sm text-label-code-sm text-tertiary">enabled: {String(job.enabled)}</span>
                    </div>
                    <div class="support-actions flex items-center gap-space-xs">
                      <button
                        class="px-space-sm py-1 rounded-xl bg-fill hover:bg-fill text-label font-label-code text-label-code transition-colors duration-selection ease-fluid flex items-center gap-1"
                        onclick={() => inspectJob(job.id)}
                        type="button"
                      >
                        <span aria-hidden="true" class="material-symbols-outlined text-[14px]">visibility</span>
                        <span>Ver Detalhe</span>
                      </button>

                      {#if job.source !== 'yaml'}
                        {#if job.status === 'scheduled'}
                          <button disabled={pendingActions.has(job.id)}
                            class="px-space-sm py-1 rounded-xl bg-fill hover:bg-fill text-secondary-label hover:text-label font-label-code text-label-code transition-colors duration-selection ease-fluid flex items-center gap-1"
                            onclick={() => openReschedule(job.id, job.source)}
                            type="button"
                          >
                            <span aria-hidden="true" class="material-symbols-outlined text-[14px]">edit_calendar</span>
                            <span>Reagendar</span>
                          </button>
                          <button disabled={pendingActions.has(job.id)}
                            class="px-space-sm py-1 rounded-xl bg-error-container/30 hover:bg-error-container text-error font-label-code text-label-code transition-colors duration-selection ease-fluid flex items-center gap-1"
                            onclick={() => handleCancelJob(job)}
                            type="button"
                          >
                            <span aria-hidden="true" class="material-symbols-outlined text-[14px]">cancel</span>
                            <span>Cancelar</span>
                          </button>
                        {:else}
                          <span class="font-label-code-sm text-secondary-label px-space-sm py-1 rounded-xl bg-fill/60 flex items-center gap-1">
                            <span aria-hidden="true" class="material-symbols-outlined text-[14px]">info</span>
                            <span>{job.status === 'paused' ? 'Pausado / Cancelado' : job.status === 'done' ? 'Concluído' : job.status}</span>
                          </span>
                        {/if}
                      {/if}

                      <button disabled={pendingActions.has(job.id)}
                        class="px-space-sm py-1 rounded-xl bg-accent hover:bg-accent/90 text-on-primary font-label-code text-label-code transition-colors duration-selection ease-fluid flex items-center gap-1 font-semibold"
                        onclick={() => handleRunJob(job.id)}
                        title="Retorno 202 = enfileirado no gateway, não garante entrega imediata"
                        type="button"
                      >
                        <span aria-hidden="true" class="material-symbols-outlined text-[14px]">bolt</span>
                        <span>Disparar Agora</span>
                      </button>
                    </div>
                  </div>
                </article>
              {/each}
            {/if}
          </div>
        </div>

        {#if selectedId}
          <JobInspector jobId={selectedId} refreshKey={detailRevision} onclose={() => (selectedId = null)} oninspect={inspectJob} onchange={async () => { if (contact) await loadJobsForContact(contact.phone); }} />
        {/if}
      </div>
    </div>
  {/if}
</div>

<RescheduleModal
  open={rescheduleModalOpen}
  jobId={rescheduleTargetJobId}
  onclose={() => (rescheduleModalOpen = false)}
  onsuccess={() => {
    if (contact) loadJobsForContact(contact.phone);
  }}
/>
