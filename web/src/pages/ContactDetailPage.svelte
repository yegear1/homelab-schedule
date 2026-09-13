<script lang="ts">
  import { api, ApiClientError } from '../lib/api';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import type { Contact, JobListItem, Job, MessageTemplate, JobKind } from '../lib/types';
  import RescheduleModal from '../components/RescheduleModal.svelte';

  const contactId = $derived(router.params.contactId || '');

  let contact = $state<Contact | null>(null);
  let jobs = $state<JobListItem[]>([]);
  let selectedJob = $state<Job | null>(null);
  let templates = $state<MessageTemplate[]>([]);

  let loading = $state(true);
  let jobsLoading = $state(false);
  let errorMsg = $state<string | null>(null);

  // Edit contact form
  let editName = $state('');
  let editPhone = $state('');
  let savingContact = $state(false);

  // Create job form
  let jobTitle = $state('');
  let jobKind = $state<JobKind>('once');
  let jobRunAt = $state('');
  let jobCronExpr = $state('');
  let jobContent = $state('');
  let jobTemplateId = $state<string | null>(null);
  let jobCreatedBy = $state('');
  let creatingJob = $state(false);

  // Reschedule modal
  let rescheduleModalOpen = $state(false);
  let rescheduleTargetJobId = $state('');

  $effect(() => {
    if (contactId) {
      loadContactData();
      loadTemplates();
    }
  });

  async function loadTemplates() {
    try {
      templates = await api.getTemplates();
    } catch {
      // Non-critical
    }
  }

  async function loadContactData() {
    loading = true;
    errorMsg = null;
    try {
      contact = await api.getContact(contactId);
      editName = contact.name;
      editPhone = contact.phone;
      jobCreatedBy = contact.phone;
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

  async function loadJobsForContact(phone: string) {
    jobsLoading = true;
    try {
      jobs = await api.getJobs({ status: 'all', phone });
      if (jobs.length > 0 && (!selectedJob || !jobs.find(j => j.id === selectedJob?.id))) {
        await inspectJob(jobs[0].id);
      }
    } catch (err: unknown) {
      toast.error('Falha ao carregar recados do contato.');
    } finally {
      jobsLoading = false;
    }
  }

  async function inspectJob(jobId: string) {
    try {
      selectedJob = await api.getJob(jobId);
    } catch (err: unknown) {
      toast.error('Falha ao carregar detalhes do job selecionado.');
    }
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

  async function handleCreateJob(e: SubmitEvent) {
    e.preventDefault();
    if (!contact) return;

    if (!jobTitle.trim()) {
      toast.error('Informe o título do agendamento.');
      return;
    }

    if (jobKind === 'once' && !jobRunAt) {
      toast.error('Informe data e hora para execução única.');
      return;
    }

    if (jobKind === 'cron') {
      if (!jobCronExpr.trim() || jobCronExpr.trim().split(/\s+/).length !== 5) {
        toast.error('Expressão cron precisa de 5 campos.');
        return;
      }
    }

    if (!jobContent.trim() && !jobTemplateId) {
      toast.error('Forneça o conteúdo da mensagem ou selecione um template.');
      return;
    }

    creatingJob = true;
    try {
      await api.createJob({
        title: jobTitle.trim(),
        to: contact.phone,
        kind: jobKind,
        run_at: jobKind === 'once' && jobRunAt ? new Date(jobRunAt).toISOString() : null,
        cron_expr: jobKind === 'cron' ? jobCronExpr.trim() : null,
        content: jobTemplateId ? null : jobContent.trim(),
        template_id: jobTemplateId || null,
        created_by: jobCreatedBy.trim() || null,
      });

      toast.success(`Job "${jobTitle}" agendado com sucesso.`);
      jobTitle = '';
      jobContent = '';
      jobTemplateId = null;
      jobRunAt = '';
      jobCronExpr = '';
      await loadJobsForContact(contact.phone);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar job';
      toast.error(msg);
    } finally {
      creatingJob = false;
    }
  }

  async function handleRunJob(jobId: string) {
    try {
      const res = await api.runJob(jobId);
      toast.queued(`POST /jobs/${jobId}/run: 202 Enfileirado no gateway (${res.status})`);
      if (contact) await loadJobsForContact(contact.phone);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao disparar recado';
      toast.error(msg);
    }
  }

  async function handleCancelJob(jobItem: JobListItem | Job) {
    if (jobItem.source === 'yaml') {
      toast.error('Erro 409: Jobs de routines.yaml não podem ser cancelados via API.');
      return;
    }
    if (!confirm(`Deseja cancelar o recado [${jobItem.id}]?`)) return;

    try {
      await api.cancelJob(jobItem.id);
      toast.success(`Recado ${jobItem.id} cancelado com sucesso.`);
      if (contact) await loadJobsForContact(contact.phone);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cancelar recado';
      toast.error(msg);
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

  function selectTemplate(tpl: MessageTemplate) {
    jobTemplateId = tpl.id;
    jobContent = tpl.body;
    toast.info(`Modelo ${tpl.name} selecionado.`);
  }

  function clearTemplate() {
    jobTemplateId = null;
    jobContent = '';
  }
</script>

<div class="flex flex-col w-full" data-state={loading ? 'loading' : errorMsg ? 'error' : 'ready'} id="scr-contact">
  <!-- Top Bar & Breadcrumb Navigation -->
  <div class="flex items-center justify-between pb-space-md mb-space-md border-b border-outline-variant/10">
    <nav aria-label="Navegação estrutural" class="flex items-center gap-space-sm">
      <a class="inline-flex items-center gap-space-xs font-label-ui text-label-ui uppercase tracking-wider text-primary hover:text-primary-fixed transition-colors" href="/contacts">
        <span class="material-symbols-outlined text-[16px]">arrow_back</span>
        <span>Voltar para Contatos</span>
      </a>
      <span class="text-outline text-label-code-sm">/</span>
      <span class="font-label-code-sm text-label-code-sm text-on-surface-variant font-mono">UID: {contactId}</span>
    </nav>
    <div class="flex items-center gap-space-sm">
      <span class="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded bg-tertiary/10 text-tertiary font-label-code-sm text-label-code-sm">
        <span class="h-1.5 w-1.5 rounded-full bg-tertiary"></span>
        <span>REGISTRO VÁLIDO</span>
      </span>
      <span class="font-label-code-sm text-label-code-sm text-outline font-mono">NODE_HASH: 0x8F3A21C</span>
    </div>
  </div>

  {#if loading}
    <div class="p-space-xl text-center flex flex-col items-center justify-center gap-space-xs text-outline font-label-code-sm">
      <span class="material-symbols-outlined text-primary text-[32px] animate-spin">sync</span>
      <span>Carregando ficha do contato...</span>
    </div>
  {:else if errorMsg}
    <div class="p-space-xl text-center flex flex-col items-center justify-center gap-space-md bg-surface-container-low rounded border border-outline-variant/20">
      <span class="material-symbols-outlined text-error text-[40px]">person_off</span>
      <span class="font-headline-sm text-on-surface">{errorMsg}</span>
      <a class="px-space-md py-space-sm bg-primary text-on-primary rounded font-label-ui text-label-ui uppercase" href="/contacts">
        Voltar para Lista
      </a>
    </div>
  {:else if contact}
    <!-- wdg-contact-header: Perfil do Contato & Ações Primárias -->
    <section class="bg-surface-container-low rounded p-space-lg mb-space-lg shadow-sm border border-outline-variant/10" id="wdg-contact-header">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-lg">
        <div class="flex items-start sm:items-center gap-space-md min-w-0">
          <div class="relative shrink-0 w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center">
            <span class="material-symbols-outlined text-primary text-[28px]">contact_phone</span>
            <span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-tertiary ring-2 ring-surface-container-low"></span>
          </div>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-space-sm flex-wrap">
              <h1 class="font-headline-md text-headline-md text-on-surface tracking-tight truncate">{contact.name}</h1>
              <span class="inline-flex items-center gap-1 px-space-sm py-0.5 rounded bg-tertiary-container/20 text-tertiary font-label-ui text-label-ui uppercase tracking-wider">
                <span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                Ativo no sistema
              </span>
              <span class="font-label-code-sm text-label-code-sm text-outline font-mono">ID: {contact.id}</span>
            </div>
            <div class="flex items-center gap-space-md mt-1 flex-wrap font-label-code text-label-code text-on-surface-variant font-mono">
              <span class="flex items-center gap-1 text-primary-fixed-dim">
                <span class="material-symbols-outlined text-[14px]">call</span>
                {contact.phone}
              </span>
              <span class="text-outline">|</span>
              <span class="flex items-center gap-1 text-on-surface-variant">
                <span class="material-symbols-outlined text-[14px]">dns</span>
                Origem: sqlite_wal
              </span>
            </div>
          </div>
        </div>

        <!-- Ação Destrutiva com Guardrail -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-space-md shrink-0">
          <div class="max-w-xs text-right sm:text-right hidden sm:block">
            <p class="font-label-code-sm text-label-code-sm text-error/90 flex items-center gap-1 justify-end font-mono">
              <span class="material-symbols-outlined text-[14px]">warning</span>
              Prevenção 409 Ativa
            </p>
            <p class="font-label-code-sm text-label-code-sm text-outline">Bloqueado se houver job 'scheduled' para este número.</p>
          </div>
          <button
            class="px-space-md py-space-sm rounded bg-error-container/40 hover:bg-error-container text-error hover:text-on-error-container font-label-ui text-label-ui uppercase tracking-wider transition-colors flex items-center gap-space-xs shadow-sm"
            id="btn-delete-contact"
            onclick={handleDeleteContact}
            type="button"
          >
            <span class="material-symbols-outlined text-[16px]">delete_forever</span>
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
        <div class="bg-surface-container-low rounded p-space-lg shadow-sm border border-outline-variant/10" id="wdg-contact-edit">
          <div class="flex items-center justify-between pb-space-sm mb-space-md">
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-primary text-[18px]">edit_note</span>
              <h2 class="font-headline-sm text-headline-sm text-on-surface">Atualizar Contato</h2>
            </div>
            <span class="font-label-code-sm text-label-code-sm text-primary font-mono">PATCH /contacts/{contact.id}</span>
          </div>

          <form class="flex flex-col gap-space-md" id="form-edit-contact" onsubmit={handlePatchContact}>
            <div class="flex flex-col gap-1">
              <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="input-edit-name">
                Nome Completo
              </label>
              <input
                class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                id="input-edit-name"
                name="name"
                type="text"
                bind:value={editName}
              />
              <span class="font-body-sm text-body-sm text-outline">Opcional. Deixe intacto se desejar manter.</span>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="input-edit-phone">
                Telefone E.164
              </label>
              <input
                class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary transition-all font-mono"
                id="input-edit-phone"
                name="phone"
                type="text"
                bind:value={editPhone}
              />
              <span class="font-body-sm text-body-sm text-outline">Aceita formato internacional com DDI (+55...).</span>
            </div>

            <div class="bg-surface-container-high/60 rounded p-space-sm flex items-start gap-space-xs">
              <span class="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">sync_alt</span>
              <p class="font-body-sm text-body-sm text-on-surface-variant">
                <strong class="text-on-surface font-medium">Alerta de sincronização:</strong> Ao alterar o telefone, a lista de recados será recarregada com o novo número.
              </p>
            </div>

            <div class="flex items-center justify-end gap-space-sm pt-space-xs">
              <button
                class="px-space-md py-space-sm rounded bg-surface-container text-on-surface-variant hover:text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-colors"
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
                class="px-space-lg py-space-sm rounded bg-primary hover:bg-primary-fixed-dim text-on-primary font-label-ui text-label-ui uppercase tracking-wider transition-colors flex items-center gap-space-xs shadow-sm font-semibold"
                type="submit"
                disabled={savingContact}
              >
                <span class="material-symbols-outlined text-[16px]">save</span>
                <span>{savingContact ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        </div>

        <!-- wdg-job-create: Criar Agendamento Vinculado -->
        <div class="bg-surface-container-low rounded p-space-lg shadow-sm border border-outline-variant/10" id="wdg-job-create">
          <div class="flex items-center justify-between pb-space-sm mb-space-md">
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-primary text-[18px]">add_alarm</span>
              <h2 class="font-headline-sm text-headline-sm text-on-surface">Agendar Novo Recado</h2>
            </div>
            <span class="font-label-code-sm text-label-code-sm text-tertiary font-mono">POST /jobs</span>
          </div>

          <form class="flex flex-col gap-space-md" id="form-create-job" onsubmit={handleCreateJob}>
            <div class="flex flex-col gap-1">
              <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="job-input-title">
                Título do Agendamento *
              </label>
              <input
                class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary"
                id="job-input-title"
                name="title"
                placeholder="Ex: Lembrete Backup Diário"
                required
                type="text"
                bind:value={jobTitle}
              />
            </div>

            <!-- Kind Selection (once vs cron) -->
            <div class="flex flex-col gap-1.5">
              <span class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant">Tipo de Disparo (kind) *</span>
              <div class="grid grid-cols-2 gap-space-sm bg-surface-container-lowest p-1 rounded">
                <button
                  class="flex items-center justify-center gap-space-xs p-space-xs rounded transition-colors {jobKind === 'once' ? 'bg-surface-container-high text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}"
                  onclick={() => (jobKind = 'once')}
                  type="button"
                >
                  <span class="material-symbols-outlined text-[16px]">today</span>
                  <span class="font-label-ui text-label-ui uppercase">Único (once)</span>
                </button>
                <button
                  class="flex items-center justify-center gap-space-xs p-space-xs rounded transition-colors {jobKind === 'cron' ? 'bg-surface-container-high text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}"
                  onclick={() => (jobKind = 'cron')}
                  type="button"
                >
                  <span class="material-symbols-outlined text-[16px]">repeat</span>
                  <span class="font-label-ui text-label-ui uppercase">Recorrente (cron)</span>
                </button>
              </div>
            </div>

            <!-- Dynamic: Run At (Once) -->
            {#if jobKind === 'once'}
              <div class="flex flex-col gap-1" id="field-run-at">
                <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="job-input-run-at">
                  Data &amp; Hora de Execução (run_at) *
                </label>
                <input
                  class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary"
                  id="job-input-run-at"
                  name="run_at"
                  type="datetime-local"
                  required
                  bind:value={jobRunAt}
                />
                <span class="font-body-sm text-body-sm text-outline">Fuso horário local da máquina do despachante.</span>
              </div>
            {:else}
              <!-- Dynamic: Cron Expr (Cron) -->
              <div class="flex flex-col gap-1" id="field-cron-expr">
                <div class="flex items-center justify-between">
                  <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="job-input-cron-expr">
                    Expressão Cron (5 campos) *
                  </label>
                  <span class="font-label-code-sm text-label-code-sm text-tertiary font-mono">min h dom m dow</span>
                </div>
                <input
                  class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  id="job-input-cron-expr"
                  name="cron_expr"
                  placeholder="0 9 * * 1-5"
                  required
                  type="text"
                  bind:value={jobCronExpr}
                />
                <div class="flex items-center gap-space-xs mt-0.5">
                  <span class="font-label-code-sm text-label-code-sm text-on-surface-variant">Exemplo:</span>
                  <button class="font-label-code-sm text-label-code-sm text-primary hover:underline font-mono" onclick={() => (jobCronExpr = '0 9 * * 1-5')} type="button">
                    0 9 * * 1-5
                  </button>
                  <span class="text-outline">|</span>
                  <button class="font-label-code-sm text-label-code-sm text-primary hover:underline font-mono" onclick={() => (jobCronExpr = '0 2 * * *')} type="button">
                    0 2 * * *
                  </button>
                </div>
              </div>
            {/if}

            <!-- Destino (to) & Criador (created_by) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              <div class="flex flex-col gap-1">
                <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="job-input-to">
                  Destino (to) *
                </label>
                <input
                  class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary font-mono opacity-80"
                  id="job-input-to"
                  name="to"
                  disabled
                  value={contact.phone}
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="job-input-created-by">
                  Criador (created_by)
                </label>
                <input
                  class="bg-surface-container-lowest text-on-surface rounded px-space-md py-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  id="job-input-created-by"
                  name="created_by"
                  placeholder="Telefone ou sysadmin"
                  type="text"
                  bind:value={jobCreatedBy}
                />
              </div>
            </div>

            <!-- wdg-template-pick: Picker Rápido de Template (XOR content vs template_id) -->
            <div class="bg-surface-container-high/40 rounded p-space-sm flex flex-col gap-space-xs" id="wdg-template-pick">
              <div class="flex items-center justify-between">
                <span class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">auto_stories</span>
                  Modelos Rápidos (GET /templates)
                </span>
                <span class="font-label-code-sm text-label-code-sm text-outline">XOR Content / Template</span>
              </div>

              {#if templates.length > 0}
                <div class="grid grid-cols-2 gap-space-xs">
                  {#each templates.slice(0, 4) as tpl}
                    <button
                      class="p-space-xs text-left bg-surface-container rounded hover:bg-surface-container-high transition-colors {jobTemplateId === tpl.id ? 'ring-1 ring-primary' : ''}"
                      onclick={() => selectTemplate(tpl)}
                      type="button"
                    >
                      <div class="font-label-ui text-label-ui text-on-surface truncate">{tpl.name}</div>
                      <div class="font-body-sm text-body-sm text-outline truncate">{tpl.body}</div>
                    </button>
                  {/each}
                </div>
              {:else}
                <span class="font-label-code-sm text-label-code-sm text-outline">Nenhum modelo cadastrado no catálogo.</span>
              {/if}

              {#if jobTemplateId}
                <div class="flex items-center justify-between bg-primary/10 px-space-sm py-1 rounded text-primary font-label-code-sm text-label-code-sm mt-1" id="selected-template-pill">
                  <span>Modelo Ativo: {jobTemplateId}</span>
                  <button class="text-primary hover:text-primary-fixed" onclick={clearTemplate} type="button">
                    <span class="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              {/if}
            </div>

            <!-- Mensagem Livre (content) -->
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <label class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant" for="job-input-content">
                  Conteúdo da Mensagem (content)
                </label>
                <span class="font-label-code-sm text-label-code-sm text-outline font-mono">
                  {jobContent.length} / 4096
                </span>
              </div>
              <textarea
                class="bg-surface-container-lowest text-on-surface rounded p-space-sm font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-primary"
                id="job-input-content"
                name="content"
                placeholder={jobTemplateId ? 'Preenchido a partir do modelo selecionado acima...' : 'Digite a mensagem direta...'}
                rows="3"
                bind:value={jobContent}
                disabled={Boolean(jobTemplateId)}
              ></textarea>
            </div>

            <button
              class="w-full py-space-sm rounded bg-primary hover:bg-primary-fixed-dim text-on-primary font-label-ui text-label-ui uppercase tracking-wider transition-colors flex items-center justify-center gap-space-xs shadow-sm font-semibold mt-space-xs"
              type="submit"
              disabled={creatingJob}
            >
              <span class="material-symbols-outlined text-[18px]">send_time_extension</span>
              <span>{creatingJob ? 'Agendando...' : 'Agendar Recado'}</span>
            </button>
          </form>
        </div>
      </div>

      <!-- Coluna Direita (7 Colunas): wdg-job-list & wdg-job-detail -->
      <div class="xl:col-span-7 flex flex-col gap-space-lg">
        <!-- wdg-job-list: Listagem Unificada de Recados do Contato -->
        <div class="bg-surface-container-low rounded p-space-lg shadow-sm flex flex-col gap-space-md border border-outline-variant/10" id="wdg-job-list">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm">
            <div>
              <div class="flex items-center gap-space-xs">
                <span class="material-symbols-outlined text-primary text-[20px]">dynamic_feed</span>
                <h2 class="font-headline-sm text-headline-sm text-on-surface">Recados Vinculados</h2>
                <span class="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface font-label-code-sm text-label-code-sm font-mono">
                  {jobs.length}
                </span>
              </div>
              <p class="font-label-code-sm text-label-code-sm text-on-surface-variant font-mono mt-0.5">
                GET /jobs?status=all&amp;phone={contact.phone}
              </p>
            </div>

            <!-- Filtros / legend badges -->
            <div class="flex items-center gap-space-xs text-label-code-sm font-mono">
              <span class="inline-flex items-center gap-1 px-space-xs py-0.5 rounded bg-primary-container/20 text-primary">
                <span class="w-1.5 h-1.5 rounded-full bg-primary"></span> Destino
              </span>
              <span class="inline-flex items-center gap-1 px-space-xs py-0.5 rounded bg-secondary-container/30 text-on-secondary-container">
                <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span> Criador
              </span>
            </div>
          </div>

          <!-- Lista de Jobs -->
          <div class="flex flex-col gap-space-sm">
            {#if jobsLoading}
              <div class="p-space-lg text-center text-outline font-label-code-sm">Atualizando recados...</div>
            {:else if jobs.length === 0}
              <div class="p-space-lg text-center bg-surface-container rounded text-outline font-body-sm">
                Nenhum recado vinculado a este número no momento.
              </div>
            {:else}
              {#each jobs as job (job.id)}
                {@const isDest = job.target_number === contact.phone || job.to === contact.phone}
                <article
                  class="bg-surface-container rounded p-space-md hover:bg-surface-container-high/70 transition-all flex flex-col gap-space-sm shadow-sm cursor-pointer {selectedJob?.id === job.id ? 'ring-1 ring-primary' : ''}"
                  id="job-card-{job.id}"
                  onclick={() => inspectJob(job.id)}
                  role="presentation"
                  
                  onkeydown={(e) => { if (e.key === 'Enter') inspectJob(job.id); }}
                >
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                    <div class="flex items-center gap-space-xs flex-wrap">
                      <span class="px-space-xs py-0.5 rounded {isDest ? 'bg-primary-container/20 text-primary' : 'bg-secondary-container/40 text-secondary-fixed'} font-label-code-sm text-label-code-sm font-semibold uppercase">
                        {isDest ? 'Para este contato' : 'Criado por este contato'}
                      </span>
                      <span class="font-label-code-sm text-label-code-sm font-mono text-outline">ID: {job.id}</span>
                      <span class="font-label-code-sm text-label-code-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-tertiary font-mono">{job.kind}</span>
                      <span class="font-label-code-sm text-label-code-sm px-1.5 py-0.5 rounded bg-surface-container-highest {job.source === 'yaml' ? 'text-primary-fixed' : 'text-on-surface-variant'} font-mono">
                        src: {job.source}
                      </span>
                    </div>

                    <span class="inline-flex items-center gap-1 px-space-sm py-0.5 rounded font-label-code-sm text-label-code-sm uppercase font-mono {job.status === 'scheduled' ? 'bg-primary/10 text-primary' : job.status === 'done' ? 'bg-tertiary/10 text-tertiary' : 'bg-error-container/40 text-error'}">
                      <span class="w-1.5 h-1.5 rounded-full {job.status === 'scheduled' ? 'bg-primary animate-pulse' : job.status === 'done' ? 'bg-tertiary' : 'bg-error'}"></span>
                      {job.status}
                    </span>
                  </div>

                  <div class="flex flex-col">
                    <h3 class="font-headline-sm text-headline-sm text-on-surface">{job.title}</h3>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-space-xs mt-space-xs text-label-code-sm font-mono text-on-surface-variant">
                      <div><span class="text-outline">Para:</span> {job.target_number || job.to}</div>
                      <div><span class="text-outline">Por:</span> {job.created_by || '—'}</div>
                      <div><span class="text-outline">Exec:</span> {job.cron_expr || job.run_at || '—'}</div>
                      <div><span class="text-outline">Next:</span> {job.next_run_at ? new Date(job.next_run_at).toLocaleTimeString('pt-BR') : '—'}</div>
                    </div>
                  </div>

                  {#if job.source === 'yaml'}
                    <div class="bg-surface-container-lowest/80 p-space-xs rounded flex items-center gap-space-xs text-on-surface-variant font-label-code-sm text-label-code-sm">
                      <span class="material-symbols-outlined text-outline text-[16px]">lock</span>
                      <span>Rotina definida em <code class="text-primary font-mono">routines.yaml</code> (edição/cancelamento via HTTP indisponível - erro 409).</span>
                    </div>
                  {/if}

                  <div role="presentation" class="flex items-center justify-between pt-space-xs" onclick={(e) => e.stopPropagation()}>
                    <div class="flex items-center gap-space-xs">
                      <span class="font-label-code-sm text-label-code-sm text-tertiary">enabled: {String(job.enabled)}</span>
                    </div>
                    <div class="flex items-center gap-space-xs">
                      <button
                        class="px-space-sm py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-code text-label-code transition-colors flex items-center gap-1"
                        onclick={() => inspectJob(job.id)}
                        type="button"
                      >
                        <span class="material-symbols-outlined text-[14px]">visibility</span>
                        <span>Ver Detalhe</span>
                      </button>

                      {#if job.source !== 'yaml'}
                        <button
                          class="px-space-sm py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-label-code text-label-code transition-colors flex items-center gap-1"
                          onclick={() => openReschedule(job.id, job.source)}
                          type="button"
                        >
                          <span class="material-symbols-outlined text-[14px]">edit_calendar</span>
                          <span>Reagendar</span>
                        </button>
                        <button
                          class="px-space-sm py-1 rounded bg-error-container/30 hover:bg-error-container text-error font-label-code text-label-code transition-colors flex items-center gap-1"
                          onclick={() => handleCancelJob(job)}
                          type="button"
                        >
                          <span class="material-symbols-outlined text-[14px]">cancel</span>
                          <span>Cancelar</span>
                        </button>
                      {/if}

                      <button
                        class="px-space-sm py-1 rounded bg-primary hover:bg-primary-fixed-dim text-on-primary font-label-code text-label-code transition-colors flex items-center gap-1 font-semibold"
                        onclick={() => handleRunJob(job.id)}
                        title="Retorno 202 = enfileirado no gateway, não garante entrega imediata"
                        type="button"
                      >
                        <span class="material-symbols-outlined text-[14px]">bolt</span>
                        <span>Disparar Agora</span>
                      </button>
                    </div>
                  </div>
                </article>
              {/each}
            {/if}
          </div>
        </div>

        <!-- wdg-job-detail: Painel / Inspector do Job Selecionado -->
        {#if selectedJob}
          <aside class="bg-surface-container-low rounded p-space-lg shadow-md flex flex-col gap-space-md border border-outline-variant/10" id="wdg-job-detail">
            <div class="flex items-center justify-between pb-space-sm">
              <div class="flex items-center gap-space-xs">
                <span class="material-symbols-outlined text-primary text-[20px]">terminal</span>
                <h2 class="font-headline-sm text-headline-sm text-on-surface">Inspeção Detalhada do Job</h2>
              </div>
              <span class="font-label-code text-label-code px-space-sm py-0.5 rounded bg-surface-container-highest text-primary font-mono" id="detail-job-id-badge">
                {selectedJob.id}
              </span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-space-sm text-label-code font-mono bg-surface-container-lowest p-space-md rounded">
              <div>
                <span class="text-outline block text-label-code-sm">KIND</span>
                <span class="text-on-surface" id="detail-kind">{selectedJob.kind}</span>
              </div>
              <div>
                <span class="text-outline block text-label-code-sm">LAST STATUS</span>
                <span class="text-primary font-semibold" id="detail-status">{selectedJob.status.toUpperCase()}</span>
              </div>
              <div>
                <span class="text-outline block text-label-code-sm">RETRY COUNT</span>
                <span class="text-on-surface" id="detail-retries">{selectedJob.retry_count} / 3</span>
              </div>
              <div>
                <span class="text-outline block text-label-code-sm">ÚLTIMA EXECUÇÃO</span>
                <span class="text-on-surface-variant" id="detail-last-run">
                  {selectedJob.last_run_at ? new Date(selectedJob.last_run_at).toLocaleString('pt-BR') : 'Nunca executado'}
                </span>
              </div>
              <div>
                <span class="text-outline block text-label-code-sm">PRÓXIMA JANELA</span>
                <span class="text-tertiary" id="detail-next-run">
                  {selectedJob.next_run_at ? new Date(selectedJob.next_run_at).toLocaleString('pt-BR') : '—'}
                </span>
              </div>
              <div>
                <span class="text-outline block text-label-code-sm">ORIGEM / SOURCE</span>
                <span class="text-on-surface font-mono" id="detail-source">{selectedJob.source}</span>
              </div>
            </div>

            <!-- Conteúdo da Mensagem -->
            <div class="flex flex-col gap-1">
              <span class="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant">Conteúdo Efetivo da Mensagem</span>
              <div class="bg-surface-container-lowest p-space-md rounded font-label-code text-label-code text-on-surface whitespace-pre-wrap font-mono selection:bg-primary selection:text-on-primary max-h-48 overflow-y-auto" id="detail-content">
                {selectedJob.content || (selectedJob.template_id ? `[Template ID: ${selectedJob.template_id}]` : '(vazio)')}
              </div>
            </div>

            <!-- Diagnóstico Sanitizado -->
            {#if selectedJob.last_error}
              <div class="bg-error-container/20 rounded p-space-md flex flex-col gap-1" id="detail-error-container">
                <span class="font-label-ui text-label-ui uppercase tracking-wider text-error flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">error</span>
                  Diagnóstico de Falha Recente (Sanitizado)
                </span>
                <p class="font-label-code text-label-code text-on-error-container font-mono" id="detail-error-msg">
                  {selectedJob.last_error}
                </p>
              </div>
            {/if}

            <!-- Ações do Job Detail -->
            <div class="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs border-t border-outline-variant/10">
              <div class="flex items-center gap-space-xs">
                {#if selectedJob.source !== 'yaml'}
                  <button
                    class="px-space-md py-space-sm rounded bg-surface-container hover:bg-error-container/40 text-on-surface-variant hover:text-error font-label-ui text-label-ui uppercase tracking-wider transition-colors flex items-center gap-1"
                    id="detail-btn-cancel"
                    onclick={() => handleCancelJob(selectedJob!)}
                    type="button"
                  >
                    <span class="material-symbols-outlined text-[16px]">cancel</span>
                    <span>Cancelar Recado</span>
                  </button>
                  <button
                    class="px-space-md py-space-sm rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-ui text-label-ui uppercase tracking-wider transition-colors flex items-center gap-1"
                    id="detail-btn-reschedule"
                    onclick={() => openReschedule(selectedJob!.id, selectedJob!.source)}
                    type="button"
                  >
                    <span class="material-symbols-outlined text-[16px]">schedule</span>
                    <span>Reagendar</span>
                  </button>
                {:else}
                  <span class="font-label-code-sm text-outline flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">lock</span>
                    Rotina YAML (Imutável via API)
                  </span>
                {/if}
              </div>

              <!-- Disparo Forçado com feedback explícito de 202 -->
              <div class="relative group">
                <button
                  class="px-space-lg py-space-sm rounded bg-primary hover:bg-primary-fixed-dim text-on-primary font-label-ui text-label-ui uppercase tracking-wider transition-colors flex items-center gap-space-xs shadow-sm font-semibold"
                  onclick={() => handleRunJob(selectedJob!.id)}
                  type="button"
                >
                  <span class="material-symbols-outlined text-[16px]">bolt</span>
                  <span>Disparar Agora</span>
                </button>
                <div class="absolute bottom-full right-0 mb-2 hidden group-hover:block w-64 p-space-xs bg-surface-container-highest text-on-surface text-label-code-sm font-mono rounded shadow-xl pointer-events-none z-30">
                  Retorno 202 = enfileirado no gateway, não garante entrega imediata.
                </div>
              </div>
            </div>
          </aside>
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
