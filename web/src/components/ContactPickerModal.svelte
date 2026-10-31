<script lang="ts">
  import { api } from '../lib/api';
  import type { Contact } from '../lib/types';
  import { toast } from '../lib/toast.svelte';
  import { focusTrap } from '../lib/focusTrap';

  interface Props {
    open: boolean;
    onselect: (phoneOrAlias: string, contactName: string) => void;
    onclose: () => void;
  }

  let { open, onselect, onclose }: Props = $props();

  let contacts = $state<Contact[]>([]);
  let searchQuery = $state('');
  let loading = $state(false);

  $effect(() => {
    if (open) {
      searchQuery = '';
      loadContacts();
    }
  });

  async function loadContacts() {
    loading = true;
    try {
      contacts = await api.getContacts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar contatos';
      toast.error(msg);
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
</script>

{#if open}
  <div class="modal-backdrop" id="wdg-contact-pick">
    <div
      use:focusTrap
      class="modal-surface max-w-md flex flex-col gap-space-md cursor-default"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-picker-modal-title"
      tabindex="-1"
    >
      <div class="flex items-center justify-between pb-space-xs">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-primary text-[20px]">contacts</span>
          <div>
            <h3 id="contact-picker-modal-title" class="font-headline-sm text-headline-sm text-label">Selecionar Contato</h3>
            <span class="font-label-code-sm text-label-code-sm text-secondary-label">GET /contacts</span>
          </div>
        </div>
        <button class="modal-action modal-close text-secondary-label hover:text-label" onclick={onclose} type="button" aria-label="Fechar">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- Filtro Rápido no Picker -->
      <div class="relative">
        <input
          class="w-full bg-system-background text-label font-body-sm text-body-sm rounded pl-8 pr-space-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          id="picker-search-input"
          aria-label="Buscar contato"
          placeholder="Buscar por nome ou número..."
          type="text"
          bind:value={searchQuery}
        />
        <span class="material-symbols-outlined absolute left-2 top-2 text-[16px] text-secondary-label">search</span>
      </div>

      <!-- Opção Especial: Destino Padrão "eu" -->
      <div
        class="modal-action p-space-sm rounded bg-tertiary-system-background hover:bg-fill cursor-pointer flex items-center justify-between"
        onclick={() => {
          onselect('eu', 'Eu Mesmo (Admin)');
          onclose();
        }}
        role="button"
        tabindex="0"
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            onselect('eu', 'Eu Mesmo (Admin)');
            onclose();
          }
        }}
      >
        <div class="flex flex-col">
          <span class="font-body-md text-body-md font-semibold text-label">Eu Mesmo (Default Gateway)</span>
          <span class="font-label-code-sm text-label-code-sm text-tertiary">alias: "eu"</span>
        </div>
        <span class="font-label-code-sm text-label-code-sm text-secondary-label px-1.5 py-0.5 rounded bg-system-background">Default</span>
      </div>

      <!-- Lista de Contatos -->
      <div class="flex flex-col gap-1 max-h-60 overflow-y-auto" id="picker-contacts-list">
        {#if loading}
          <div class="p-space-md text-center text-secondary-label font-label-code-sm">Carregando contatos...</div>
        {:else if filteredContacts.length === 0}
          <div class="p-space-md text-center text-secondary-label font-label-code-sm">Nenhum contato encontrado.</div>
        {:else}
          {#each filteredContacts as contact (contact.id)}
            <div
              class="modal-action p-space-sm rounded bg-tertiary-system-background hover:bg-fill cursor-pointer flex items-center justify-between"
              onclick={() => {
                onselect(contact.phone, contact.name);
                onclose();
              }}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  onselect(contact.phone, contact.name);
                  onclose();
                }
              }}
            >
              <div class="flex flex-col">
                <span class="font-body-md text-body-md font-semibold text-label">{contact.name}</span>
                <span class="font-label-code-sm text-label-code-sm text-primary font-mono">{contact.phone}</span>
              </div>
              <span class="font-label-code-sm text-label-code-sm text-secondary-label px-1.5 py-0.5 rounded bg-system-background">{contact.id}</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
