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
    '{{date}}',
    '{{date_iso}}',
    '{{time}}',
    '{{weekday}}',
    '{{day_name}}',
    '{{month_name}}',
    '{{year}}',
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
    return templateBody
      .replace(/\{\{name\}\}/g, 'Carlos Silva')
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('pt-BR'))
      .replace(/\{\{date_iso\}\}/g, new Date().toISOString().split('T')[0])
      .replace(/\{\{time\}\}/g, new Date().toLocaleTimeString('pt-BR'))
      .replace(/\{\{weekday\}\}/g, 'Segunda-feira')
      .replace(/\{\{day_name\}\}/g, String(new Date().getDate()))
      .replace(/\{\{month_name\}\}/g, 'Setembro')
      .replace(/\{\{year\}\}/g, String(new Date().getFullYear()));
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

<div class="flex flex-col w-full" data-state={loading ? 'loading' : errorMsg ? 'error' : 'ready'} id="scr-templates">
  <!-- Top Telemetry & Context Banner -->
  <div class="grid grid-cols-1 md:grid-cols-12 gap-gutter-desktop mb-space-lg items-stretch">
    <div class="md:col-span-8 bg-surface-container-lowest p-space-lg rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden border border-outline-variant/10">
      <div class="absolute -right-12 -top-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
      <div>
        <div class="flex items-center gap-space-sm mb-space-xs">
          <span class="font-label-ui text-label-ui uppercase tracking-widest text-primary font-semibold">Motor de Mensageria</span>
          <span class="text-outline">/</span>
          <span class="font-label-code-sm text-label-code-sm text-tertiary font-mono">GET /templates</span>
        </div>
        <h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Modelos de Mensagem</h1>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-space-xs">
          Estruture padrões de despacho e interpolação léxica para rotinas locais de notificação. Variáveis suportadas são injetadas em tempo de execução via tick local SQLite.
        </p>
      </div>

      <!-- Quick Metrics Bar -->
      <div class="grid grid-cols-3 gap-space-md pt-space-lg mt-space-lg bg-surface-container-low/50 -mx-space-lg -mb-space-lg px-space-lg py-space-md border-t border-outline-variant/10">
        <div>
          <span class="font-label-ui text-label-ui text-on-surface-variant uppercase block">Modelos Ativos</span>
          <span class="font-headline-md text-headline-md text-on-surface font-semibold font-mono" id="val-total-templates">{templates.length}</span>
        </div>
        <div>
          <span class="font-label-ui text-label-ui text-on-surface-variant uppercase block">Motor Léxico</span>
          <span class="font-headline-md text-headline-md text-tertiary font-semibold font-mono">Parser v1.2</span>
        </div>
        <div>
          <span class="font-label-ui text-label-ui text-on-surface-variant uppercase block">Placeholders Válidos</span>
          <span class="font-headline-md text-headline-md text-primary font-semibold font-mono">8 Tags</span>
        </div>
      </div>
    </div>

    <!-- Homelab Node Status Card -->
    <div class="md:col-span-4 bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between shadow-sm border border-outline-variant/10">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-primary text-[18px]">terminal</span>
          <span class="font-label-ui text-label-ui uppercase text-on-surface tracking-wider font-semibold">Catálogo de Textos</span>
        </div>
        <span class="px-space-sm py-0.5 rounded bg-tertiary/10 text-tertiary font-label-code-sm text-label-code-sm font-semibold">ATIVO</span>
      </div>
      <div class="my-space-md">
        <div class="text-on-surface-variant font-label-code-sm text-label-code-sm mb-space-xs flex justify-between font-mono">
          <span>Catálogo SQLite</span>
          <span class="text-on-surface font-medium">{templates.length} registros</span>
        </div>
        <div class="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
          <div class="bg-primary h-full rounded-full transition-all duration-500" style="width: 25%;"></div>
        </div>
      </div>
      <div class="bg-surface-container-lowest p-space-sm rounded text-on-surface-variant font-label-code-sm text-label-code-sm flex flex-col gap-space-xs font-mono border border-outline-variant/10">
        <div class="flex items-center justify-between">
          <span class="text-outline">Lock WAL:</span>
          <span class="text-tertiary">EXCLUSIVE_NONE</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-outline">Constraint 409:</span>
          <span class="text-on-surface">CASCADE_PREVENT</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete Conflict Modal / Notification Bar -->
  {#if conflictAlert}
    <div class="mb-space-md p-space-md rounded-xl bg-error-container/20 text-on-error-container flex items-start gap-space-md shadow-md border border-error/30" id="delete-conflict-alert">
      <span class="material-symbols-outlined text-error text-[24px] shrink-0">report_problem</span>
      <div class="flex flex-col min-w-0 flex-1">
        <span class="font-headline-sm text-headline-sm text-error font-semibold">Falha na Exclusão (HTTP 409 Conflict)</span>
        <p class="font-body-sm text-body-sm text-on-surface mt-0.5" id="delete-conflict-msg">
          {conflictAlert}
        </p>
        <div class="mt-space-sm">
          <button class="px-space-sm py-0.5 bg-error-container text-on-error-container rounded font-label-ui text-label-ui cursor-pointer" onclick={() => (conflictAlert = null)} type="button">
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
      <div class="bg-surface-container-low p-space-md rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-md shadow-sm border border-outline-variant/10">
        <div class="flex items-center gap-space-sm">
          <span class="font-headline-sm text-headline-sm text-on-surface">Catálogo</span>
          <span class="px-space-sm py-0.5 rounded-full bg-surface-container text-primary font-label-code-sm text-label-code-sm font-semibold font-mono" id="badge-template-count">
            {filteredTemplates.length} {filteredTemplates.length === 1 ? 'registrado' : 'registrados'}
          </span>
        </div>
        <div class="relative flex-1 sm:max-w-xs">
          <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input
            class="w-full pl-8 pr-3 py-1.5 bg-surface-container-lowest text-on-surface placeholder:text-outline text-body-sm font-body-sm rounded focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            id="filter-template-input"
            placeholder="Filtrar por nome ou ID..."
            type="text"
            bind:value={filterText}
          />
        </div>
      </div>

      <!-- Feed / Cards Container -->
      <div class="flex flex-col gap-space-md" id="template-card-container">
        {#if loading}
          <div class="p-space-xl text-center text-outline font-label-code-sm">Carregando catálogo de templates...</div>
        {:else if errorMsg}
          <div class="p-space-xl text-center text-error font-body-md bg-surface-container-low rounded border border-outline-variant/10">
            {errorMsg}
          </div>
        {:else if filteredTemplates.length === 0}
          <div class="p-space-xl text-center bg-surface-container-low rounded-xl text-outline font-body-sm border border-outline-variant/10">
            Nenhum modelo encontrado no catálogo.
          </div>
        {:else}
          {#each filteredTemplates as tpl (tpl.id)}
            <div class="bg-surface-container-low rounded-xl p-space-lg shadow-sm hover:bg-surface-container transition-all flex flex-col justify-between group border border-outline-variant/10" data-template-id={tpl.id}>
              <div>
                <div class="flex items-start justify-between gap-space-md mb-space-sm">
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-space-sm mb-space-xs">
                      <span class="font-label-code-sm text-label-code-sm text-primary font-medium px-space-xs py-0.5 bg-primary/10 rounded font-mono">
                        {tpl.id}
                      </span>
                      <span class="font-label-code-sm text-label-code-sm text-outline font-mono">len: {tpl.body.length}</span>
                    </div>
                    <h2 class="font-headline-sm text-headline-sm text-on-surface truncate group-hover:text-primary transition-colors">
                      {tpl.name}
                    </h2>
                  </div>

                  <div class="flex items-center gap-space-xs shrink-0">
                    <button
                      class="px-space-sm py-1 bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface rounded font-label-ui text-label-ui transition-colors flex items-center gap-1 shadow-sm"
                      onclick={() => startEdit(tpl)}
                      type="button"
                    >
                      <span class="material-symbols-outlined text-[15px]">edit</span>
                      <span>Editar</span>
                    </button>
                    <button
                      class="px-space-sm py-1 bg-error-container/20 hover:bg-error-container text-error hover:text-on-error-container rounded font-label-ui text-label-ui transition-colors flex items-center gap-1"
                      onclick={() => handleDelete(tpl)}
                      type="button"
                    >
                      <span class="material-symbols-outlined text-[15px]">delete</span>
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>

                <!-- Body Text -->
                <div class="bg-surface-container-lowest p-space-md rounded font-label-code text-label-code text-on-surface-variant leading-relaxed tracking-normal select-all font-mono whitespace-pre-wrap">
                  {tpl.body}
                </div>
              </div>

              <div class="flex items-center justify-between mt-space-md pt-space-xs text-on-surface-variant font-label-code-sm text-label-code-sm font-mono border-t border-outline-variant/10">
                <span class="flex items-center gap-1 text-tertiary">
                  <span class="material-symbols-outlined text-[14px]">link</span>
                  <span>Catálogo persistido</span>
                </span>
                <span class="text-outline">SQLite store</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- RIGHT PANEL: Template Form & Placeholder Guide - 5 cols -->
    <div class="lg:col-span-5 flex flex-col gap-space-lg">
      <!-- FORM WIDGET: wdg-template-form -->
      <div class="bg-surface-container-low rounded-xl p-space-lg shadow-sm border border-outline-variant/10" id="wdg-template-form">
        <div class="flex items-center justify-between pb-space-md mb-space-md border-b border-outline-variant/10">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-primary text-[20px]" id="form-icon">
              {templateId ? 'edit_note' : 'add_box'}
            </span>
            <span class="font-headline-sm text-headline-sm text-on-surface" id="form-title">
              {templateId ? `Editar ${templateId}` : 'Criar Modelo'}
            </span>
          </div>
          <button
            class="px-space-sm py-1 bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded font-label-ui text-label-ui flex items-center gap-1 transition-colors"
            id="btn-reset-form"
            onclick={resetForm}
            type="button"
          >
            <span class="material-symbols-outlined text-[15px]">restart_alt</span>
            <span>Limpar / Novo</span>
          </button>
        </div>

        <form class="flex flex-col gap-space-md" id="template-editor-form" onsubmit={handleSubmit}>
          <!-- Field: Name -->
          <div class="flex flex-col gap-space-xs">
            <div class="flex items-center justify-between">
              <label class="font-label-ui text-label-ui text-on-surface uppercase font-semibold" for="template-name-input">
                Nome do Modelo <span class="text-error">*</span>
              </label>
              <span class="font-label-code-sm text-label-code-sm text-outline font-mono" id="name-counter">
                {templateName.length} / 80
              </span>
            </div>
            <input
              class="w-full px-space-md py-space-sm bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-md text-body-md rounded focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
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
            <span class="font-body-sm text-body-sm text-outline">Identificador legível no despachante (1 a 80 caracteres).</span>
          </div>

          <!-- Field: Body -->
          <div class="flex flex-col gap-space-xs">
            <div class="flex items-center justify-between">
              <label class="font-label-ui text-label-ui text-on-surface uppercase font-semibold" for="template-body-input">
                Corpo da Mensagem <span class="text-error">*</span>
              </label>
              <span class="font-label-code-sm text-label-code-sm text-outline font-mono" id="body-counter">
                {templateBody.length} caracteres
              </span>
            </div>
            <textarea
              class="w-full p-space-md bg-surface-container-lowest text-on-surface placeholder:text-outline font-label-code text-label-code rounded focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed shadow-inner font-mono"
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
            <span class="font-body-sm text-body-sm text-outline">Permite formatação textual padrão e variáveis entre chaves duplas.</span>

            {#if unknownPlaceholders.length > 0}
              <div class="p-space-xs px-space-sm rounded bg-error-container/20 text-error flex items-center gap-1.5 font-label-code-sm border border-error/30 font-mono mt-1" id="unknown-tags-warning">
                <span class="material-symbols-outlined text-[15px]">warning</span>
                <span>Tag(s) desconhecida(s) detectada(s): {unknownPlaceholders.join(', ')} (permanecerão como texto literal).</span>
              </div>
            {/if}
          </div>

          <!-- Live Preview Strip -->
          <div class="bg-surface-container p-space-sm rounded flex flex-col gap-1 border border-outline-variant/10">
            <span class="font-label-ui text-label-ui uppercase text-outline">Preview com Dados Mock</span>
            <div class="font-label-code-sm text-label-code-sm text-tertiary whitespace-pre-wrap break-words min-h-[2.5rem] font-mono" id="live-preview-box">
              {livePreview}
            </div>
          </div>

          <!-- Form Feedback -->
          {#if formFeedback}
            <div class="p-space-sm rounded font-label-code-sm text-label-code-sm flex items-center gap-space-sm {formFeedback.type === 'error' ? 'bg-error-container/30 text-error' : 'bg-tertiary/10 text-tertiary'}">
              <span class="material-symbols-outlined text-[16px]">{formFeedback.type === 'error' ? 'error' : 'check'}</span>
              <span>{formFeedback.message}</span>
            </div>
          {/if}

          <!-- Submit Buttons -->
          <div class="flex items-center gap-space-sm pt-space-xs">
            <button
              class="flex-1 py-space-sm px-space-md bg-primary hover:bg-primary-container text-on-primary rounded font-label-ui text-label-ui font-semibold flex items-center justify-center gap-space-xs shadow-md transition-all active:scale-[0.98]"
              id="btn-submit-template"
              type="submit"
              disabled={saving}
            >
              <span class="material-symbols-outlined text-[18px]">send</span>
              <span id="submit-btn-label">{saving ? 'Salvando...' : templateId ? 'Salvar Alterações (PATCH)' : 'Criar Modelo (POST)'}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- PLACEHOLDER GUIDE SECTION -->
      <div class="bg-surface-container-low rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border border-outline-variant/10">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-secondary text-[20px]">variable_insert</span>
          <h3 class="font-headline-sm text-headline-sm text-on-surface">Guia de Placeholders Dinâmicos</h3>
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant">
          Clique nas tags para inseri-las diretamente na posição atual do cursor no formulário.
        </p>

        <!-- Destinatário -->
        <div class="flex flex-col gap-space-xs">
          <span class="font-label-ui text-label-ui uppercase tracking-wider text-outline">Destinatário</span>
          <div class="flex flex-wrap gap-space-xs">
            <button
              class="btn-insert-placeholder px-space-sm py-1 bg-surface-container hover:bg-primary/20 hover:text-primary text-on-surface rounded font-label-code text-label-code transition-colors flex items-center gap-1 group shadow-xs font-mono"
              onclick={() => insertPlaceholder('{{name}}')}
              type="button"
            >
              <span class="text-primary group-hover:underline font-semibold">{`{{name}}`}</span>
              <span class="text-outline text-label-code-sm">(Nome contato)</span>
            </button>
          </div>
        </div>

        <!-- Relógio e Data -->
        <div class="flex flex-col gap-space-xs">
          <span class="font-label-ui text-label-ui uppercase tracking-wider text-outline">Relógio &amp; Calendário (Tick Local)</span>
          <div class="flex flex-wrap gap-space-xs font-mono">
            {#each [
              { tag: '{{date}}', label: 'DD/MM/AAAA' },
              { tag: '{{date_iso}}', label: 'AAAA-MM-DD' },
              { tag: '{{time}}', label: 'HH:MM:SS' },
              { tag: '{{weekday}}', label: 'Dia da semana (ex: Segunda)' },
              { tag: '{{day_name}}', label: 'Dia do mês (ex: 15)' },
              { tag: '{{month_name}}', label: 'Mês (ex: Setembro)' },
              { tag: '{{year}}', label: 'Ano (ex: 2026)' }
            ] as item}
              <button
                class="btn-insert-placeholder px-space-sm py-1 bg-surface-container hover:bg-primary/20 hover:text-primary text-on-surface rounded font-label-code text-label-code transition-colors group shadow-xs"
                onclick={() => insertPlaceholder(item.tag)}
                type="button"
              >
                <span class="text-primary group-hover:underline font-semibold">{item.tag}</span>
                <span class="text-outline text-label-code-sm ml-1">{item.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Strict Warning -->
        <div class="bg-surface-container-lowest p-space-md rounded flex items-start gap-space-sm text-outline-variant border border-outline-variant/10">
          <span class="material-symbols-outlined text-outline text-[18px] shrink-0 mt-0.5">info</span>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            <strong>Aviso de sintaxe:</strong> Placeholders desconhecidos permanecerão literais no disparo. Variáveis de linguagens externas como <code class="text-outline font-mono">Jinja</code> ou interpolações <code class="text-outline font-mono">${'{var}'}</code> não são interpretadas pela API.
          </p>
        </div>

        <!-- API Specs -->
        <div class="p-space-sm rounded bg-surface-container-highest/40 flex flex-col gap-space-xs font-label-code-sm text-label-code-sm font-mono border border-outline-variant/10">
          <span class="font-label-ui text-label-ui uppercase text-on-surface-variant font-semibold font-sans">Tabela de Códigos HTTP</span>
          <div class="flex items-center justify-between text-outline">
            <span>200 OK / 201 Created</span>
            <span class="text-tertiary">Sucesso de operação</span>
          </div>
          <div class="flex items-center justify-between text-outline">
            <span>401 Unauthorized</span>
            <span class="text-error">Token x-api-key ausente/inválido</span>
          </div>
          <div class="flex items-center justify-between text-outline">
            <span>409 Conflict</span>
            <span class="text-error">Nome duplicado ou job ativo vinculado</span>
          </div>
          <div class="flex items-center justify-between text-outline">
            <span>422 Unprocessable</span>
            <span class="text-error">Payload malformado (body vazio / length &gt; 80)</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
