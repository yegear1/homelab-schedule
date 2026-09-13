<script lang="ts">
  import { api, ApiClientError } from '../lib/api';
  import type { Contact } from '../lib/types';
  import { toast } from '../lib/toast.svelte';

  let contacts = $state<Contact[]>([]);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);
  let searchQuery = $state('');

  // Formulário de criação
  let newName = $state('');
  let newPhone = $state('');
  let creating = $state(false);
  let formFeedback = $state<{ type: 'error' | 'success'; title: string; message: string } | null>(null);

  $effect(() => {
    loadContacts();
  });

  async function loadContacts() {
    loading = true;
    errorMsg = null;
    try {
      contacts = await api.getContacts();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 401) {
        errorMsg = 'Chave x-api-key não configurada ou inválida. Clique no ícone de perfil para configurar.';
      } else {
        errorMsg = err instanceof Error ? err.message : 'Falha ao carregar contatos do SQLite';
      }
    } finally {
      loading = false;
    }
  }

  const filteredContacts = $derived.by(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  });

  const pageState = $derived.by(() => {
    if (loading) return 'loading';
    if (errorMsg) return 'error';
    return 'ready';
  });

  const listState = $derived.by(() => {
    if (loading) return 'loading';
    if (errorMsg) return 'error';
    if (filteredContacts.length === 0) return 'empty';
    return 'ready';
  });

  async function handleCreateContact(e: SubmitEvent) {
    e.preventDefault();
    formFeedback = null;

    const trimmedName = newName.trim();
    const trimmedPhone = newPhone.trim();

    if (!trimmedName || !trimmedPhone) {
      formFeedback = {
        type: 'error',
        title: 'Dados Incompletos',
        message: 'Nome e telefone são campos obrigatórios.',
      };
      return;
    }

    creating = true;
    try {
      const created = await api.createContact({ name: trimmedName, phone: trimmedPhone });
      formFeedback = {
        type: 'success',
        title: '201 Created',
        message: `Contato ${created.name} adicionado ao SQLite com sucesso!`,
      };
      toast.success(`Contato ${created.name} registrado.`);
      newName = '';
      newPhone = '';
      await loadContacts();
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 409) {
        formFeedback = {
          type: 'error',
          title: 'Erro 409 (Conflict)',
          message: 'Este nome ou telefone já se encontra cadastrado no banco SQLite local.',
        };
      } else if (err instanceof ApiClientError && err.status === 422) {
        formFeedback = {
          type: 'error',
          title: 'Erro 422 (Unprocessable Entity)',
          message: err.detail || 'Estrutura E.164 fora de conformidade.',
        };
      } else {
        const msg = err instanceof Error ? err.message : 'Falha ao cadastrar contato';
        formFeedback = {
          type: 'error',
          title: 'Erro na Criação',
          message: msg,
        };
      }
    } finally {
      creating = false;
    }
  }
</script>

<div class="flex flex-col w-full" data-state={pageState} id="scr-contacts">
  <!-- Top Banner & Metrics -->
  <div class="flex flex-col lg:flex-row items-start justify-between gap-space-lg mb-space-xl pb-space-lg">
    <div class="flex flex-col gap-space-xs max-w-2xl">
      <div class="flex items-center gap-space-sm">
        <span class="px-space-sm py-0.5 rounded bg-surface-container-low font-label-code-sm text-label-code-sm text-primary uppercase tracking-widest">
          Módulo 01
        </span>
        <span class="text-outline font-label-code-sm text-label-code-sm">/</span>
        <span class="font-label-code-sm text-label-code-sm text-on-surface-variant">API Gateway WhatsApp Local</span>
      </div>
      <h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Caderno de Contatos</h1>
      <p class="font-body-md text-body-md text-on-surface-variant">
        Gerencie as rotas de mensageria direta, listas prioritárias de broadcast e receptores automatizados para alertas de telemetria do cluster.
      </p>
    </div>

    <div class="flex items-center gap-space-md w-full lg:w-auto justify-end">
      <div class="bg-surface-container-low p-space-md rounded flex items-center gap-space-lg shadow-sm border border-outline-variant/10">
        <div class="flex flex-col">
          <span class="font-label-ui text-label-ui uppercase text-outline">Cluster Telemetria</span>
          <span class="font-label-code text-label-code text-tertiary flex items-center gap-1">
            <span class="h-1.5 w-1.5 rounded-full bg-tertiary animate-pulse"></span>
            DISPATCHER WAL: OK
          </span>
        </div>
        <div class="h-8 w-px bg-surface-container-highest"></div>
        <div class="flex flex-col">
          <span class="font-label-ui text-label-ui uppercase text-outline">Capacidade Local</span>
          <span class="font-label-code text-label-code text-on-surface font-mono">{contacts.length} Ativos / 10k max</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Grid Principal (8 colunas Lista / 4 colunas Formulário) -->
  <div class="grid grid-cols-1 xl:grid-cols-12 gap-gutter-desktop items-start">
    <!-- WIDGET CONTACT LIST (wdg-contact-list) -->
    <section class="xl:col-span-8 flex flex-col gap-space-md" data-state={listState} id="wdg-contact-list">
      <div class="bg-surface-container-low p-space-md rounded shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-md border border-outline-variant/10">
        <div class="flex items-center gap-space-md">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-primary text-[20px]">contacts</span>
            <h2 class="font-headline-sm text-headline-sm text-on-surface">Destinatários Registrados</h2>
          </div>
          <span class="px-space-sm py-0.5 rounded-full bg-primary/10 text-primary font-label-code-sm text-label-code-sm font-semibold" id="contact-count-badge">
            {filteredContacts.length} {filteredContacts.length === 1 ? 'contato' : 'contatos'}
          </span>
        </div>

        <div class="relative flex-1 max-w-md">
          <span class="material-symbols-outlined absolute left-space-sm top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input
            class="w-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm pl-9 pr-space-md py-space-sm rounded outline-none placeholder:text-outline/70 focus:bg-surface-container-high transition-colors"
            id="search-input"
            placeholder="Filtrar por nome, ID ou formato E.164..."
            type="text"
            bind:value={searchQuery}
          />
        </div>
      </div>

      <!-- Tabela / Cartões de Contatos -->
      <div class="bg-surface-container-lowest rounded shadow-md overflow-x-auto flex flex-col border border-outline-variant/10">
        <div class="min-w-[560px] flex flex-col">
          <div class="px-space-lg py-space-sm bg-surface-container-low/50 flex items-center justify-between text-outline font-label-ui text-label-ui uppercase tracking-wider">
            <div class="w-24">ID Node</div>
            <div class="flex-1 px-space-md">Contato &amp; Rotas Vinculadas</div>
            <div class="w-48 text-left">Número E.164</div>
            <div class="w-28 text-right">Ação</div>
          </div>

          <div class="flex flex-col divide-y divide-surface-container-high/30" id="contact-rows-container">
          {#if loading}
            <div class="p-space-xl text-center flex flex-col items-center justify-center gap-space-xs text-outline font-label-code-sm">
              <span class="material-symbols-outlined text-primary text-[28px] animate-spin">sync</span>
              <span>Carregando caderno de contatos...</span>
            </div>
          {:else if errorMsg}
            <div class="p-space-xl text-center flex flex-col items-center justify-center gap-space-xs text-error font-body-md">
              <span class="material-symbols-outlined text-error text-[32px]">error</span>
              <span>{errorMsg}</span>
              <button
                class="mt-space-sm px-space-md py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded font-label-ui text-label-ui"
                onclick={loadContacts}
                type="button"
              >
                Tentar Novamente
              </button>
            </div>
          {:else if filteredContacts.length === 0}
            <div class="p-space-xl text-center flex flex-col items-center justify-center gap-space-xs" id="no-contacts-found">
              <span class="material-symbols-outlined text-outline text-[32px]">person_off</span>
              <span class="font-headline-sm text-headline-sm text-on-surface">Nenhum contato encontrado</span>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Tente refinar os termos do filtro ou registre um novo canal à direita.</p>
            </div>
          {:else}
            {#each filteredContacts as contact (contact.id)}
              <div
                class="contact-row group px-space-lg py-space-md bg-surface-container-lowest hover:bg-surface-container-high/60 transition-colors flex items-center justify-between"
                data-id={contact.id}
                data-name={contact.name}
                data-phone={contact.phone}
              >
                <div class="w-24">
                  <span class="font-label-code-sm text-label-code-sm px-space-xs py-0.5 rounded bg-surface-container-highest text-primary font-medium font-mono">
                    {contact.id}
                  </span>
                </div>

                <div class="flex-1 px-space-md flex flex-col min-w-0">
                  <div class="flex items-center gap-space-sm">
                    <span class="font-body-lg text-body-lg text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
                      {contact.name}
                    </span>
                    <span class="px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant font-label-code-sm text-label-code-sm">
                      Destino
                    </span>
                  </div>
                  <div class="flex items-center gap-space-xs font-label-code-sm text-label-code-sm text-on-surface-variant mt-0.5 font-mono">
                    <span class="h-1.5 w-1.5 rounded-full bg-tertiary"></span>
                    <span>Registro ativo no SQLite</span>
                  </div>
                </div>

                <div class="w-48 flex items-center gap-space-xs font-mono">
                  <span class="material-symbols-outlined text-outline text-[16px]">call</span>
                  <span class="font-label-code text-label-code text-on-surface tracking-tight">{contact.phone}</span>
                </div>

                <div class="w-28 flex justify-end">
                  <a
                    class="px-space-md py-1 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface font-label-ui text-label-ui transition-all flex items-center gap-1 shadow-sm"
                    href={`/contacts/${encodeURIComponent(contact.id)}`}
                  >
                    <span>Abrir Ficha</span>
                    <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                  </a>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>

      <!-- Rodapé do Widget List -->
      <div class="p-space-md rounded bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm border border-outline-variant/10">
        <div class="flex items-center gap-space-xs text-on-surface-variant font-label-code-sm text-label-code-sm">
          <span class="material-symbols-outlined text-tertiary text-[16px]">sync</span>
          <span>Sincronização com repositório SQLite WAL local ativa</span>
        </div>
        <span class="font-label-code-sm text-label-code-sm text-outline font-mono">GET /contacts: 200 OK</span>
      </div>
    </section>

    <!-- WIDGET CONTACT CREATE (wdg-contact-create) -->
    <aside class="xl:col-span-4 flex flex-col gap-space-md" id="wdg-contact-create">
      <div class="bg-surface-container-low p-space-lg rounded shadow-md flex flex-col gap-space-md border border-outline-variant/10">
        <div class="flex items-center justify-between pb-space-xs">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-primary text-[20px]">person_add</span>
            <h2 class="font-headline-sm text-headline-sm text-on-surface">Novo Destinatário</h2>
          </div>
          <span class="font-label-code-sm text-label-code-sm px-space-xs py-0.5 rounded bg-surface-container text-outline font-mono">
            POST /contacts
          </span>
        </div>

        <p class="font-body-sm text-body-sm text-on-surface-variant">
          Adiciona um destinatário à tabela SQLite local para uso imediato em templates e cron jobs.
        </p>

        <form class="flex flex-col gap-space-md mt-space-xs" id="form-create-contact" onsubmit={handleCreateContact}>
          <div class="flex flex-col gap-space-xs">
            <div class="flex justify-between items-center">
              <label class="font-label-ui text-label-ui uppercase text-on-surface-variant font-semibold" for="contact-name">
                Identificador / Nome Completo <span class="text-error">*</span>
              </label>
              <span class="font-label-code-sm text-label-code-sm text-outline font-mono">1-80 chars</span>
            </div>
            <input
              class="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md px-space-md py-space-sm rounded outline-none placeholder:text-outline/60 focus:bg-surface-container-high transition-colors"
              id="contact-name"
              maxlength="80"
              name="name"
              placeholder="Ex: Alerta Infra / Dra. Marina"
              required
              type="text"
              bind:value={newName}
              oninvalid={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('Informe o nome do contato.')}
              oninput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('')}
            />
          </div>

          <div class="flex flex-col gap-space-xs">
            <div class="flex justify-between items-center">
              <label class="font-label-ui text-label-ui uppercase text-on-surface-variant font-semibold" for="contact-phone">
                Telefone ou Alias de Despacho <span class="text-error">*</span>
              </label>
              <span class="font-label-code-sm text-label-code-sm text-outline font-mono">1-64 chars</span>
            </div>
            <input
              class="w-full bg-surface-container-lowest text-on-surface font-label-code text-label-code px-space-md py-space-sm rounded outline-none placeholder:text-outline/60 focus:bg-surface-container-high transition-colors font-mono"
              id="contact-phone"
              maxlength="64"
              name="phone"
              placeholder="Ex: +55 11 90000-0000 ou alias"
              required
              type="text"
              bind:value={newPhone}
              oninvalid={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('Informe o telefone ou destino do contato.')}
              oninput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity('')}
            />
            <span class="font-label-code-sm text-label-code-sm text-outline">
              Número internacional E.164, número nacional ou alias configurado.
            </span>
          </div>

          {#if formFeedback}
            <div
              class="p-space-sm rounded flex items-start gap-space-xs font-body-sm text-body-sm transition-all {formFeedback.type === 'error' ? 'bg-error-container/30 text-error' : 'bg-tertiary/10 text-tertiary'}"
              id="api-feedback"
            >
              <span class="material-symbols-outlined text-[16px] mt-0.5">
                {formFeedback.type === 'error' ? 'warning' : 'check_circle'}
              </span>
              <div class="flex flex-col flex-1">
                <span class="font-label-code-sm text-label-code-sm font-semibold">{formFeedback.title}</span>
                <span class="font-label-code-sm text-label-code-sm">{formFeedback.message}</span>
              </div>
            </div>
          {/if}

          <button
            class="w-full mt-space-xs py-space-sm px-space-md bg-primary hover:bg-primary-container text-on-primary font-label-ui text-label-ui uppercase tracking-wider rounded transition-all flex items-center justify-center gap-space-xs shadow-sm font-semibold"
            id="btn-submit-contact"
            type="submit"
            disabled={creating}
          >
            <span class="material-symbols-outlined text-[16px]">{creating ? 'hourglass_empty' : 'add_circle'}</span>
            <span>{creating ? 'Adicionando...' : 'Adicionar Contato'}</span>
          </button>
        </form>

        <div class="flex flex-col gap-space-xs pt-space-md bg-surface-container-low border-t border-outline-variant/10">
          <span class="font-label-ui text-label-ui uppercase text-outline flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">info</span>
            Resolução de Erros &amp; Códigos
          </span>
          <div class="grid grid-cols-1 gap-space-xs text-on-surface-variant font-label-code-sm text-label-code-sm">
            <div class="flex items-center justify-between p-1.5 rounded bg-surface-container-lowest font-mono">
              <span class="text-error font-medium">HTTP 401</span>
              <span>Chave x-api-key ausente/inválida</span>
            </div>
            <div class="flex items-center justify-between p-1.5 rounded bg-surface-container-lowest font-mono">
              <span class="text-error font-medium">HTTP 409</span>
              <span>Nome ou telefone já cadastrado</span>
            </div>
            <div class="flex items-center justify-between p-1.5 rounded bg-surface-container-lowest font-mono">
              <span class="text-error font-medium">HTTP 422</span>
              <span>Estrutura E.164 fora de conformidade</span>
            </div>
          </div>
        </div>

        <div class="p-space-sm rounded bg-surface-container-lowest flex items-start gap-space-xs text-on-surface-variant border border-outline-variant/10">
          <span class="material-symbols-outlined text-outline text-[16px] mt-0.5">lock_person</span>
          <p class="font-body-sm text-body-sm text-outline">
            <span class="font-medium text-on-surface">Nota técnica homelab:</span> Os contatos não autenticam no sistema. A chave <code class="font-label-code-sm text-label-code-sm text-tertiary">x-api-key</code> opera localmente na máquina servidora para proteção do daemon.
          </p>
        </div>
      </div>
    </aside>
  </div>
</div>
