<script lang="ts">
  import { api } from '../lib/api';
  import type { Contact } from '../lib/types';
  import { toast } from '../lib/toast.svelte';

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
  <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-space-md" id="wdg-contact-pick">
    <div class="bg-surface-container-low max-w-md w-full rounded shadow-xl p-space-md flex flex-col gap-space-sm border border-outline-variant/30">
      <div class="flex items-center justify-between pb-space-xs">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-primary text-[20px]">contacts</span>
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Selecionar Contato</h3>
            <span class="font-label-code-sm text-label-code-sm text-outline">GET /contacts</span>
          </div>
        </div>
        <button class="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container" onclick={onclose} type="button">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- Filtro Rápido no Picker -->
      <div class="relative">
        <input
          class="w-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded pl-8 pr-space-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          id="picker-search-input"
          placeholder="Buscar por nome ou número..."
          type="text"
          bind:value={searchQuery}
        />
        <span class="material-symbols-outlined absolute left-2 top-2 text-[16px] text-outline">search</span>
      </div>

      <!-- Opção Especial: Destino Padrão "eu" -->
      <div
        class="p-space-sm rounded bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-between"
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
          <span class="font-body-md text-body-md font-semibold text-on-surface">Eu Mesmo (Default Gateway)</span>
          <span class="font-label-code-sm text-label-code-sm text-tertiary">alias: "eu"</span>
        </div>
        <span class="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container-lowest">Default</span>
      </div>

      <!-- Lista de Contatos -->
      <div class="flex flex-col gap-1 max-h-60 overflow-y-auto" id="picker-contacts-list">
        {#if loading}
          <div class="p-space-md text-center text-outline font-label-code-sm">Carregando contatos...</div>
        {:else if filteredContacts.length === 0}
          <div class="p-space-md text-center text-outline font-label-code-sm">Nenhum contato encontrado.</div>
        {:else}
          {#each filteredContacts as contact (contact.id)}
            <div
              class="p-space-sm rounded bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-between"
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
                <span class="font-body-md text-body-md font-semibold text-on-surface">{contact.name}</span>
                <span class="font-label-code-sm text-label-code-sm text-primary font-mono">{contact.phone}</span>
              </div>
              <span class="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container-lowest">{contact.id}</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
