<script lang="ts">
  import { api, ApiClientError } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import type { MessageTemplate } from '../lib/types';

  let templates = $state<MessageTemplate[]>([]);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);
  let filterText = $state('');

  // Form state
  let templateId = $state('');
  let templateName = $state('');
  let templateBody = $state('');
  let saving = $state(false);
  let formFeedback = $state<{ type: 'error' | 'success'; message: string } | null>(null);
  let bodyTextareaEl: HTMLTextAreaElement | null = $state(null);

  // 409 alert state
  let conflictAlert = $state<string | null>(null);

  $effect(() => {
    loadTemplates();
  });

  async function loadTemplates() {
    loading = true;
    errorMsg = null;
    try {
      templates = await api.getTemplates();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        errorMsg = 'Chave x-api-key ausente ou inválida. Configure pelo ícone de perfil no topo.';
      } else {
        errorMsg = err instanceof Error ? err.message : 'Falha ao carregar catálogo de templates';
      }
    } finally {
      loading = false;
    }
  }

  const filteredTemplates = $derived.by(() => {
    const q = filterText.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.body.toLowerCase().includes(q));
  });

  const VALID_TAGS = new Set([
    '{{name}}',
    '{{greeting}}',
    '{{greeting_lower}}',
    '{{saudacao}}',
    '{{saudacao_lower}}',
    '{{period}}',
    '{{date}}',
    '{{date_iso}}',
    '{{time}}',
    '{{weekday}}',
    '{{day_name}}',
    '{{month_name}}',
    '{{year}}',
    '{{day}}',
    '{{month}}',
    '{{hour}}',
    '{{minute}}',
  ]);

  const unknownPlaceholders = $derived.by(() => {
    const matches = templateBody.match(/\{\{[^}]+\}\}/g) || [];
    const unknowns = matches.filter((tag) => !VALID_TAGS.has(tag));
    return Array.from(new Set(unknowns));
  });

  const livePreview = $derived.by(() => {
    if (!templateBody.trim()) {
      return 'Digite no campo acima para gerar a simulação imediata...';
    }
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Boa noite';
    let greetingLower = 'boa noite';
    let period = 'noite';
    if (hour >= 5 && hour < 12) {
      greeting = 'Bom dia';
      greetingLower = 'bom dia';
      period = 'manhã';
    } else if (hour >= 12 && hour < 18) {
      greeting = 'Boa tarde';
      greetingLower = 'boa tarde';
      period = 'tarde';
    }

    return templateBody
      .replace(/\{\{greeting_lower\}\}/g, greetingLower)
      .replace(/\{\{saudacao_lower\}\}/g, greetingLower)
      .replace(/\{\{greeting\}\}/g, greeting)
      .replace(/\{\{saudacao\}\}/g, greeting)
      .replace(/\{\{period\}\}/g, period)
      .replace(/\{\{name\}\}/g, 'Carlos Silva')
      .replace(/\{\{date_iso\}\}/g, now.toISOString().split('T')[0])
      .replace(/\{\{date\}\}/g, now.toLocaleDateString('pt-BR'))
      .replace(/\{\{time\}\}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      .replace(/\{\{day_name\}\}/g, 'segunda-feira')
      .replace(/\{\{weekday\}\}/g, 'seg')
      .replace(/\{\{month_name\}\}/g, 'setembro')
      .replace(/\{\{year\}\}/g, String(now.getFullYear()))
      .replace(/\{\{day\}\}/g, String(now.getDate()).padStart(2, '0'))
      .replace(/\{\{month\}\}/g, String(now.getMonth() + 1).padStart(2, '0'))
      .replace(/\{\{hour\}\}/g, String(hour).padStart(2, '0'))
      .replace(/\{\{minute\}\}/g, String(now.getMinutes()).padStart(2, '0'));
  });

  function resetForm() {
    templateId = '';
    templateName = '';
    templateBody = '';
    formFeedback = null;
  }

  function startEdit(tpl: MessageTemplate) {
    templateId = tpl.id;
    templateName = tpl.name;
    templateBody = tpl.body;
    formFeedback = null;
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
  }

  function insertPlaceholder(val: string) {
    if (!bodyTextareaEl) {
      templateBody += val;
      return;
    }
    const start = bodyTextareaEl.selectionStart || 0;
    const end = bodyTextareaEl.selectionEnd || 0;
    templateBody = templateBody.substring(0, start) + val + templateBody.substring(end);
    const newPos = start + val.length;
    setTimeout(() => {
      bodyTextareaEl?.focus();
      bodyTextareaEl?.setSelectionRange(newPos, newPos);
    }, 10);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    formFeedback = null;

    const nameVal = templateName.trim();
    const bodyVal = templateBody.trim();

    if (!nameVal || !bodyVal) {
      formFeedback = { type: 'error', message: 'Nome e corpo do modelo são obrigatórios.' };
      return;
    }

    saving = true;
    try {
      if (templateId) {
        // PATCH
        await api.patchTemplate(templateId, { name: nameVal, body: bodyVal });
        toast.success(`Modelo ${nameVal} atualizado.`);
      } else {
        // POST
        const created = await api.createTemplate({ name: nameVal, body: bodyVal });
        toast.success(`Modelo ${created.name} criado.`);
      }
      resetForm();
      await loadTemplates();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 409) {
        formFeedback = { type: 'error', message: 'HTTP 409: Já existe um modelo com este nome.' };
      } else {
        const msg = err instanceof Error ? err.message : 'Falha ao salvar modelo';
        formFeedback = { type: 'error', message: msg };
      }
    } finally {
      saving = false;
    }
  }

  async function handleDelete(tpl: MessageTemplate) {
    conflictAlert = null;
    if (!confirm(`Confirma a exclusão do modelo "${tpl.name}"?`)) return;

    try {
      await api.deleteTemplate(tpl.id);
      toast.success(`Modelo ${tpl.name} excluído com sucesso.`);
      if (templateId === tpl.id) resetForm();
      await loadTemplates();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 409) {
        conflictAlert = `Não é possível excluir o modelo "${tpl.name}" (ID: ${tpl.id}) pois ele possui jobs "scheduled" ativos na fila do despachante. Remova os agendamentos vinculados primeiro.`;
        toast.error('HTTP 409 Conflict: Modelo possui jobs vinculados.');
      } else {
        const msg = err instanceof Error ? err.message : 'Falha ao excluir modelo';
        toast.error(msg);
      }
    }
  }
</script>

<div class="support-page flex flex-col w-full" data-state={loading ? 'loading' : errorMsg ? 'error' : 'ready'} id="scr-templates">
  <!-- Top Telemetry & Context Banner -->
  <div class="grid grid-cols-1 md:grid-cols-12 gap-gutter-desktop mb-space-lg items-stretch">
    <div class="support-panel md:col-span-8 bg-system-background p-space-lg rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden border border-separator/60">
      <div class="absolute -right-12 -top-12 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>
      <div>
        <div class="flex items-center gap-space-sm mb-space-xs">
          <span class="font-label-ui text-label-ui uppercase tracking-widest text-accent font-semibold">Motor de Mensageria</span>
          <span class="text-secondary-label">/</span>
          <span class="font-label-code-sm text-label-code-sm text-tertiary font-mono">GET /templates</span>
        </div>
        <h1 class="font-headline-lg text-headline-lg text-label tracking-tight">Modelos de Mensagem</h1>
        <p class="font-body-md text-body-md text-secondary-label max-w-2xl mt-space-xs">
          Estruture padrões de despacho e interpolação léxica para rotinas locais de notificação. Variáveis suportadas são injetadas em tempo de execução via tick local SQLite.
        </p>
      </div>

      <!-- Quick Metrics Bar -->
      <div class="grid grid-cols-3 gap-space-md pt-space-lg mt-space-lg bg-secondary-system-background/50 -mx-space-lg -mb-space-lg px-space-lg py-space-md border-t border-separator/60">
        <div>
          <span class="font-label-ui text-label-ui text-secondary-label uppercase block">Modelos Ativos</span>
          <span class="font-headline-md text-headline-md text-label font-semibold font-mono" id="val-total-templates">{templates.length}</span>
        </div>
        <div>
          <span class="font-label-ui text-label-ui text-secondary-label uppercase block">Motor Léxico</span>
          <span class="font-headline-md text-headline-md text-tertiary font-semibold font-mono">Parser v1.2</span>
        </div>
        <div>
          <span class="font-label-ui text-label-ui text-secondary-label uppercase block">Placeholders Válidos</span>
          <span class="font-headline-md text-headline-md text-accent font-semibold font-mono">{VALID_TAGS.size} Tags</span>
        </div>
      </div>
    </div>

    <!-- Homelab Node Status Card -->
    <div class="support-panel md:col-span-4 bg-secondary-system-background p-space-lg rounded-xl flex flex-col justify-between shadow-sm border border-separator/60">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-space-xs">
          <span aria-hidden="true" class="material-symbols-outlined text-accent text-[18px]">terminal</span>
          <span class="font-label-ui text-label-ui uppercase text-label tracking-wider font-semibold">Catálogo de Textos</span>
        </div>
        <span class="px-space-sm py-0.5 rounded-xl bg-tertiary/10 text-tertiary font-label-code-sm text-label-code-sm font-semibold">ATIVO</span>
      </div>
      <div class="my-space-md">
        <div class="text-secondary-label font-label-code-sm text-label-code-sm mb-space-xs flex justify-between font-mono">
          <span>Catálogo SQLite</span>
          <span class="text-label font-medium">{templates.length} registros</span>
        </div>
        <div class="w-full bg-fill h-1.5 rounded-full overflow-hidden">
          <div class="bg-accent h-full rounded-full transition-colors duration-selection ease-fluid duration-selection" style="width: 25%;"></div>
        </div>
      </div>
      <div class="bg-system-background p-space-sm rounded-xl text-secondary-label font-label-code-sm text-label-code-sm flex flex-col gap-space-xs font-mono border border-separator/60">
        <div class="flex items-center justify-between">
          <span class="text-secondary-label">Lock WAL:</span>
          <span class="text-tertiary">EXCLUSIVE_NONE</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-secondary-label">Constraint 409:</span>
          <span class="text-label">CASCADE_PREVENT</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete Conflict Modal / Notification Bar -->
  {#if conflictAlert}
    <div class="mb-space-md p-space-md rounded-xl bg-error-container/20 text-on-error-container flex items-start gap-space-md shadow-md border border-error/30" id="delete-conflict-alert">
      <span aria-hidden="true" class="material-symbols-outlined text-error text-[24px] shrink-0">report_problem</span>
      <div class="flex flex-col min-w-0 flex-1">
        <span class="font-headline-sm text-headline-sm text-error font-semibold">Falha na Exclusão (HTTP 409 Conflict)</span>
        <p class="font-body-sm text-body-sm text-label mt-0.5" id="delete-conflict-msg">
          {conflictAlert}
        </p>
        <div class="mt-space-sm">
          <button class="px-space-sm py-0.5 bg-error-container text-on-error-container rounded-xl font-label-ui text-label-ui cursor-pointer" onclick={() => (conflictAlert = null)} type="button">
            Entendido
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Work Area: Grid 12 Cols -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-start">
    <!-- LEFT PANEL: Template List (wdg-template-list) - 7 cols -->
    <div class="lg:col-span-7 flex flex-col gap-space-md" data-state={loading ? 'loading' : errorMsg ? 'error' : filteredTemplates.length === 0 ? 'empty' : 'ready'} id="wdg-template-list">
      <!-- Search and Header Toolbar -->
      <div class="support-panel bg-secondary-system-background p-space-md rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-md shadow-sm border border-separator/60">
        <div class="flex items-center gap-space-sm">
          <span class="font-headline-sm text-headline-sm text-label">Catálogo</span>
          <span class="px-space-sm py-0.5 rounded-full bg-tertiary-system-background text-accent font-label-code-sm text-label-code-sm font-semibold font-mono" id="badge-template-count">
            {filteredTemplates.length} {filteredTemplates.length === 1 ? 'registrado' : 'registrados'}
          </span>
        </div>
        <div class="relative flex-1 sm:max-w-xs">
          <span aria-hidden="true" class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-label text-[18px]">search</span>
          <input
            class="w-full pl-8 pr-3 py-1.5 bg-system-background text-label placeholder:text-secondary-label text-body-sm font-body-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-accent shadow-inner"
            id="filter-template-input"
            aria-label="Filtrar modelos"
            placeholder="Filtrar por nome ou ID..."
            type="text"
            bind:value={filterText}
          />
        </div>
      </div>

      <!-- Feed / Cards Container -->
      <div class="flex flex-col gap-space-md" id="template-card-container">
        {#if loading}
          <div class="p-space-xl text-center text-secondary-label font-label-code-sm">Carregando catálogo de templates...</div>
        {:else if errorMsg}
          <div class="p-space-xl text-center text-error font-body-md bg-secondary-system-background rounded-xl border border-separator/60">
            {errorMsg}
          </div>
        {:else if filteredTemplates.length === 0}
          <div class="p-space-xl text-center bg-secondary-system-background rounded-xl text-secondary-label font-body-sm border border-separator/60">
            Nenhum modelo encontrado no catálogo.
          </div>
        {:else}
          {#each filteredTemplates as tpl (tpl.id)}
            <div class="support-panel bg-secondary-system-background rounded-xl p-space-lg shadow-sm hover:bg-tertiary-system-background transition-colors duration-selection ease-fluid flex flex-col justify-between group border border-separator/60" data-template-id={tpl.id}>
              <div>
                <div class="flex items-start justify-between gap-space-md mb-space-sm">
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-space-sm mb-space-xs">
                      <span class="font-label-code-sm text-label-code-sm text-accent font-medium px-space-xs py-0.5 bg-accent/10 rounded-xl font-mono">
                        {tpl.id}
                      </span>
                      <span class="font-label-code-sm text-label-code-sm text-secondary-label font-mono">len: {tpl.body.length}</span>
                    </div>
                    <h2 class="font-headline-sm text-headline-sm text-label truncate group-hover:text-accent transition-colors duration-selection ease-fluid">
                      {tpl.name}
                    </h2>
                  </div>

                  <div class="support-actions flex items-center gap-space-xs shrink-0">
                    <button
                      class="px-space-sm py-1 bg-fill hover:bg-accent hover:text-on-primary text-label rounded-xl font-label-ui text-label-ui transition-colors duration-selection ease-fluid flex items-center gap-1 shadow-sm"
                      onclick={() => startEdit(tpl)}
                      type="button"
                    >
                      <span aria-hidden="true" class="material-symbols-outlined text-[15px]">edit</span>
                      <span>Editar</span>
                    </button>
                    <button
                      class="px-space-sm py-1 bg-error-container/20 hover:bg-error-container text-error hover:text-on-error-container rounded-xl font-label-ui text-label-ui transition-colors duration-selection ease-fluid flex items-center gap-1"
                      onclick={() => handleDelete(tpl)}
                      type="button"
                    >
                      <span aria-hidden="true" class="material-symbols-outlined text-[15px]">delete</span>
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>

                <!-- Body Text -->
                <div class="bg-system-background p-space-md rounded-xl font-label-code text-label-code text-secondary-label leading-relaxed tracking-normal select-all font-mono whitespace-pre-wrap">
                  {tpl.body}
                </div>
              </div>

              <div class="flex items-center justify-between mt-space-md pt-space-xs text-secondary-label font-label-code-sm text-label-code-sm font-mono border-t border-separator/60">
                <span class="flex items-center gap-1 text-tertiary">
                  <span aria-hidden="true" class="material-symbols-outlined text-[14px]">link</span>
                  <span>Catálogo persistido</span>
                </span>
                <span class="text-secondary-label">SQLite store</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- RIGHT PANEL: Template Form & Placeholder Guide - 5 cols -->
    <div class="lg:col-span-5 flex flex-col gap-space-lg">
      <!-- FORM WIDGET: wdg-template-form -->
      <div class="support-panel bg-secondary-system-background rounded-xl p-space-lg shadow-sm border border-separator/60" id="wdg-template-form">
        <div class="flex items-center justify-between pb-space-md mb-space-md border-b border-separator/60">
          <div class="flex items-center gap-space-xs">
            <span aria-hidden="true" class="material-symbols-outlined text-accent text-[20px]" id="form-icon">
              {templateId ? 'edit_note' : 'add_box'}
            </span>
            <span class="font-headline-sm text-headline-sm text-label" id="form-title">
              {templateId ? `Editar ${templateId}` : 'Criar Modelo'}
            </span>
          </div>
          <button
            class="px-space-sm py-1 bg-tertiary-system-background hover:bg-fill text-secondary-label hover:text-label rounded-xl font-label-ui text-label-ui flex items-center gap-1 transition-colors duration-selection ease-fluid"
            id="btn-reset-form"
            onclick={resetForm}
            type="button"
          >
            <span aria-hidden="true" class="material-symbols-outlined text-[15px]">restart_alt</span>
            <span>Limpar / Novo</span>
          </button>
        </div>

        <form class="flex flex-col gap-space-md" id="template-editor-form" onsubmit={handleSubmit}>
          <!-- Field: Name -->
          <div class="flex flex-col gap-space-xs">
            <div class="flex items-center justify-between">
              <label class="font-label-ui text-label-ui text-label uppercase font-semibold" for="template-name-input">
                Nome do Modelo <span class="text-error">*</span>
              </label>
              <span class="font-label-code-sm text-label-code-sm text-secondary-label font-mono" id="name-counter">
                {templateName.length} / 80
              </span>
            </div>
            <input
              class="w-full px-space-md py-space-sm bg-system-background text-label placeholder:text-secondary-label font-body-md text-body-md rounded-xl focus:outline-none focus:ring-1 focus:ring-accent shadow-inner"
              id="template-name-input"
              maxlength="80"
              name="name"
              placeholder="ex: Aviso de Deploy Finalizado"
              required
              type="text"
              bind:value={templateName}
              oninvalid={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('Informe o nome do modelo.')}
              oninput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('')}
            />
            <span class="font-body-sm text-body-sm text-secondary-label">Identificador legível no despachante (1 a 80 caracteres).</span>
          </div>

          <!-- Field: Body -->
          <div class="flex flex-col gap-space-xs">
            <div class="flex items-center justify-between">
              <label class="font-label-ui text-label-ui text-label uppercase font-semibold" for="template-body-input">
                Corpo da Mensagem <span class="text-error">*</span>
              </label>
              <span class="font-label-code-sm text-label-code-sm text-secondary-label font-mono" id="body-counter">
                {templateBody.length} caracteres
              </span>
            </div>
            <textarea
              class="w-full p-space-md bg-system-background text-label placeholder:text-secondary-label font-label-code text-label-code rounded-xl focus:outline-none focus:ring-1 focus:ring-accent leading-relaxed shadow-inner font-mono"
              id="template-body-input"
              name="body"
              placeholder="Digite o texto da mensagem e clique nas tags abaixo para injetar as variáveis dinâmicas..."
              required
              rows="6"
              bind:this={bodyTextareaEl}
              bind:value={templateBody}
              oninvalid={(e) => (e.currentTarget as HTMLTextAreaElement).setCustomValidity('Informe o corpo da mensagem do modelo.')}
              oninput={(e) => (e.currentTarget as HTMLTextAreaElement).setCustomValidity('')}
            ></textarea>
            <span class="font-body-sm text-body-sm text-secondary-label">Permite formatação textual padrão e variáveis entre chaves duplas.</span>

            {#if unknownPlaceholders.length > 0}
              <div class="p-space-xs px-space-sm rounded-xl bg-error-container/20 text-error flex items-center gap-1.5 font-label-code-sm border border-error/30 font-mono mt-1" id="unknown-tags-warning">
                <span aria-hidden="true" class="material-symbols-outlined text-[15px]">warning</span>
                <span>Tag(s) desconhecida(s) detectada(s): {unknownPlaceholders.join(', ')} (permanecerão como texto literal).</span>
              </div>
            {/if}
          </div>

          <!-- Live Preview Strip -->
          <div class="bg-tertiary-system-background p-space-sm rounded-xl flex flex-col gap-1 border border-separator/60">
            <span class="font-label-ui text-label-ui uppercase text-secondary-label">Preview com Dados Mock</span>
            <div class="font-label-code-sm text-label-code-sm text-tertiary whitespace-pre-wrap break-words min-h-[2.5rem] font-mono" id="live-preview-box">
              {livePreview}
            </div>
          </div>

          <!-- Form Feedback -->
          {#if formFeedback}
            <div class="p-space-sm rounded-xl font-label-code-sm text-label-code-sm flex items-center gap-space-sm {formFeedback.type === 'error' ? 'bg-error-container/30 text-error' : 'bg-tertiary/10 text-tertiary'}">
              <span aria-hidden="true" class="material-symbols-outlined text-[16px]">{formFeedback.type === 'error' ? 'error' : 'check'}</span>
              <span>{formFeedback.message}</span>
            </div>
          {/if}

          <!-- Submit Buttons -->
          <div class="flex items-center gap-space-sm pt-space-xs">
            <button
              class="flex-1 py-space-sm px-space-md bg-accent hover:bg-accent/90 text-on-primary rounded-xl font-label-ui text-label-ui font-semibold flex items-center justify-center gap-space-xs shadow-md transition-colors duration-selection ease-fluid"
              id="btn-submit-template"
              type="submit"
              disabled={saving}
            >
              <span aria-hidden="true" class="material-symbols-outlined text-[18px]">send</span>
              <span id="submit-btn-label">{saving ? 'Salvando...' : templateId ? 'Salvar Alterações (PATCH)' : 'Criar Modelo (POST)'}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- PLACEHOLDER GUIDE SECTION -->
      <div class="support-panel bg-secondary-system-background rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border border-separator/60">
        <div class="flex items-center gap-space-xs">
          <span aria-hidden="true" class="material-symbols-outlined text-secondary text-[20px]">variable_insert</span>
          <h3 class="font-headline-sm text-headline-sm text-label">Guia de Placeholders Dinâmicos</h3>
        </div>
        <p class="font-body-sm text-body-sm text-secondary-label">
          Clique nas tags para inseri-las diretamente na posição atual do cursor no formulário.
        </p>

        <!-- Destinatário -->
        <div class="flex flex-col gap-space-xs">
          <span class="font-label-ui text-label-ui uppercase tracking-wider text-secondary-label">Destinatário</span>
          <div class="flex flex-wrap gap-space-xs">
            <button
              class="btn-insert-placeholder px-space-sm py-1 bg-tertiary-system-background hover:bg-accent/20 hover:text-accent text-label rounded-xl font-label-code text-label-code transition-colors duration-selection ease-fluid flex items-center gap-1 group shadow-xs font-mono"
              onclick={() => insertPlaceholder('{{name}}')}
              type="button"
            >
              <span class="text-accent group-hover:underline font-semibold">{`{{name}}`}</span>
              <span class="text-secondary-label text-label-code-sm">(Nome contato)</span>
            </button>
          </div>
        </div>

        <!-- Saudações Contextuais -->
        <div class="flex flex-col gap-space-xs">
          <span class="font-label-ui text-label-ui uppercase tracking-wider text-secondary-label">Saudações Contextuais (Horário Local)</span>
          <div class="flex flex-wrap gap-space-xs font-mono">
            {#each [
              { tag: '{{greeting}}', label: 'Bom dia / Boa tarde / Boa noite' },
              { tag: '{{greeting_lower}}', label: 'bom dia / boa tarde / boa noite' },
              { tag: '{{saudacao}}', label: 'Alias de saudação' },
              { tag: '{{period}}', label: 'manhã / tarde / noite' }
            ] as item}
              <button
                class="btn-insert-placeholder px-space-sm py-1 bg-tertiary-system-background hover:bg-accent/20 hover:text-accent text-label rounded-xl font-label-code text-label-code transition-colors duration-selection ease-fluid group shadow-xs"
                onclick={() => insertPlaceholder(item.tag)}
                type="button"
              >
                <span class="text-accent group-hover:underline font-semibold">{item.tag}</span>
                <span class="text-secondary-label text-label-code-sm ml-1">{item.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Relógio e Data -->
        <div class="flex flex-col gap-space-xs">
          <span class="font-label-ui text-label-ui uppercase tracking-wider text-secondary-label">Relógio &amp; Calendário (Tick Local)</span>
          <div class="flex flex-wrap gap-space-xs font-mono">
            {#each [
              { tag: '{{date}}', label: 'DD/MM/AAAA' },
              { tag: '{{date_iso}}', label: 'AAAA-MM-DD' },
              { tag: '{{time}}', label: 'HH:MM' },
              { tag: '{{day}}', label: 'Dia do mês (ex: 15)' },
              { tag: '{{day_name}}', label: 'Dia da semana por extenso (ex: segunda-feira)' },
              { tag: '{{weekday}}', label: 'Dia da semana curto (ex: seg)' },
              { tag: '{{month_name}}', label: 'Mês por extenso (ex: setembro)' },
              { tag: '{{month}}', label: 'Mês 2 dígitos (ex: 09)' },
              { tag: '{{year}}', label: 'Ano (ex: 2026)' },
              { tag: '{{hour}}', label: 'Hora (ex: 14)' },
              { tag: '{{minute}}', label: 'Minuto (ex: 30)' }
            ] as item}
              <button
                class="btn-insert-placeholder px-space-sm py-1 bg-tertiary-system-background hover:bg-accent/20 hover:text-accent text-label rounded-xl font-label-code text-label-code transition-colors duration-selection ease-fluid group shadow-xs"
                onclick={() => insertPlaceholder(item.tag)}
                type="button"
              >
                <span class="text-accent group-hover:underline font-semibold">{item.tag}</span>
                <span class="text-secondary-label text-label-code-sm ml-1">{item.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Strict Warning -->
        <div class="bg-system-background p-space-md rounded-xl flex items-start gap-space-sm text-secondary-label border border-separator/60">
          <span aria-hidden="true" class="material-symbols-outlined text-secondary-label text-[18px] shrink-0 mt-0.5">info</span>
          <p class="font-body-sm text-body-sm text-secondary-label">
            <strong>Aviso de sintaxe:</strong> Placeholders desconhecidos permanecerão literais no disparo. Variáveis de linguagens externas como <code class="text-secondary-label font-mono">Jinja</code> ou interpolações <code class="text-secondary-label font-mono">${'{var}'}</code> não são interpretadas pela API.
          </p>
        </div>

        <!-- API Specs -->
        <div class="p-space-sm rounded-xl bg-fill/40 flex flex-col gap-space-xs font-label-code-sm text-label-code-sm font-mono border border-separator/60">
          <span class="font-label-ui text-label-ui uppercase text-secondary-label font-semibold font-sans">Tabela de Códigos HTTP</span>
          <div class="flex items-center justify-between text-secondary-label">
            <span>200 OK / 201 Created</span>
            <span class="text-tertiary">Sucesso de operação</span>
          </div>
          <div class="flex items-center justify-between text-secondary-label">
            <span>401 Unauthorized</span>
            <span class="text-error">Token x-api-key ausente/inválido</span>
          </div>
          <div class="flex items-center justify-between text-secondary-label">
            <span>409 Conflict</span>
            <span class="text-error">Nome duplicado ou job ativo vinculado</span>
          </div>
          <div class="flex items-center justify-between text-secondary-label">
            <span>422 Unprocessable</span>
            <span class="text-error">Payload malformado (body vazio / length &gt; 80)</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
