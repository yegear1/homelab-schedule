<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import type { Contact } from '../lib/types';
  import type { ReadState } from '../lib/jobs/agenda';
  import ContactForm from '../components/contacts/ContactForm.svelte';
  import Button from '../components/ui/Button.svelte';
  let resource = $state<ReadState<Contact[]>>({ status: 'loading' });
  let search = $state('');
  let generation = 0;
  const contacts = $derived(resource.status === 'ready' ? resource.data : []);
  const filtered = $derived(contacts.filter(contact => [contact.name, contact.phone, contact.id].some(value => value.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))));
  onMount(() => { void _load(); return () => { generation++; }; });
  async function _load(): Promise<void> {
    const request = ++generation;
    resource = { status: 'loading' };
    try { const data = await api.getContacts(); if (request === generation) resource = { status: 'ready', data }; }
    catch (err) { if (request === generation) resource = { status: 'error', error: err instanceof Error ? err.message : 'Falha ao carregar contatos.' }; }
  }
</script>
<div id="scr-contacts" class="grid gap-6" data-state={resource.status}>
  <header class="flex flex-wrap items-start justify-between gap-4"><div><h1 class="text-3xl font-semibold">Contatos</h1><p class="ui-hint">Pessoas usadas como destinatários e criadores de recados.</p></div><Button onclick={_load} disabled={resource.status === 'loading'}>Atualizar contatos</Button></header>
  <div class="contacts-layout">
    <section id="wdg-contact-list" class="ui-panel grid gap-4 content-start min-w-0" data-state={resource.status === 'ready' && !filtered.length ? 'empty' : resource.status}>
      <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold text-xl">Caderno de contatos</h2><span id="contact-count-badge" class="ui-hint tabular-nums">{resource.status === 'ready' ? `${filtered.length} de ${contacts.length}` : '—'}</span></div>
      <div class="ui-field"><label for="search-input">Buscar nome, telefone ou ID</label><input id="search-input" class="ui-input" type="search" bind:value={search} /></div>
      {#if resource.status === 'loading'}<p role="status">Carregando contatos…</p>
      {:else if resource.status === 'error'}<p role="alert" class="text-error">{resource.error}</p><Button onclick={_load}>Tentar novamente</Button>
      {:else if !filtered.length}<p id="no-contacts-found" class="ui-hint">{contacts.length ? 'Nenhum contato corresponde à busca.' : 'Nenhum contato cadastrado. Adicione o primeiro contato ao lado.'}</p>
      {:else}<ul id="contact-rows-container" class="grid gap-2">{#each filtered as contact (contact.id)}<li><a class="contact-row" href="/contacts/{contact.id}"><strong>{contact.name}</strong><span>{contact.phone}</span><span class="ui-hint">{contact.id}</span></a></li>{/each}</ul>{/if}
    </section>
    <ContactForm onsaved={async () => { await _load(); }} />
  </div>
</div>
<style>
  .contacts-layout { display: grid; gap: 16px; min-width: 0; }
  .contact-row { display: grid; gap: 4px; padding: 16px; border: 1px solid rgb(var(--separator)); border-radius: 12px; overflow-wrap: anywhere; min-height: 44px; }
  .contact-row strong { color: rgb(var(--accent)); }
  .contact-row:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 2px; }
  @media (min-width: 1024px) { .contacts-layout { grid-template-columns: minmax(0, 3fr) minmax(300px, 2fr); align-items: start; } }
</style>
