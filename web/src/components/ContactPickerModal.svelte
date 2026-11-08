<script lang="ts">
  import { api } from '../lib/api';
  import type { Contact } from '../lib/types';
  import Dialog from './ui/Dialog.svelte';
  import Button from './ui/Button.svelte';
  import Field from './ui/Field.svelte';
  type Props = { open: boolean; onselect: (phoneOrAlias: string, contactName: string) => void; onclose: () => void };
  let { open, onselect, onclose }: Props = $props();
  let contacts = $state<Contact[]>([]);
  let query = $state('');
  let loading = $state(false);
  let error = $state('');
  let version = 0;
  const filtered = $derived(contacts.filter((contact) =>
    [contact.name, contact.phone, contact.id].some((value) => value.toLowerCase().includes(query.trim().toLowerCase()))));

  $effect(() => {
    if (open) {
      query = '';
      void loadContacts();
      return () => { version += 1; };
    }
  });

  async function loadContacts(): Promise<void> {
    const current = ++version;
    loading = true;
    error = '';
    contacts = [];
    try {
      const result = await api.getContacts();
      if (current === version) contacts = result;
    } catch (cause: unknown) {
      if (current === version) error = cause instanceof Error ? cause.message : 'Falha ao carregar contatos.';
    } finally {
      if (current === version) loading = false;
    }
  }

  function select(value: string, name: string): void { onselect(value, name); onclose(); }
</script>

{#if open}
  <Dialog id="wdg-contact-pick" title="Selecionar Contato" {onclose}>
    <div class="mt-4 flex min-w-0 flex-col gap-4">
      <Field id="picker-search-input" label="Buscar contato">
        <input class="ui-input" id="picker-search-input" type="search" placeholder="Nome, número ou ID" bind:value={query} />
      </Field>
      <Button onclick={() => select('eu', 'Eu mesmo')}>Eu mesmo (eu)</Button>
      <div id="picker-contacts-list" class="flex min-w-0 flex-col gap-2" data-state={loading ? 'loading' : error ? 'error' : filtered.length ? 'ready' : 'empty'}>
        {#if loading}<p class="ui-hint" role="status">Carregando contatos…</p>
        {:else if error}<p class="ui-field-error" role="alert">{error}</p><Button onclick={loadContacts}>Tentar novamente</Button>
        {:else if !filtered.length}<p class="ui-hint">{query ? 'Nenhum contato corresponde à busca.' : 'Nenhum contato cadastrado.'}</p>
        {:else}
          {#each filtered as contact (contact.id)}
            <Button onclick={() => select(contact.phone, contact.name)}>
              <span class="flex min-w-0 flex-1 flex-col items-start break-all text-left"><strong>{contact.name}</strong><span class="ui-hint">{contact.phone}</span></span>
            </Button>
          {/each}
        {/if}
      </div>
    </div>
  </Dialog>
{/if}
