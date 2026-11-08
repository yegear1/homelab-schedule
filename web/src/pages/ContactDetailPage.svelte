<script lang="ts">
  import { api, ApiClientError } from '../lib/api';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import type { Contact } from '../lib/types';
  import type { ReadState } from '../lib/jobs/agenda';
  import ContactForm from '../components/contacts/ContactForm.svelte';
  import ContactJobs from '../components/contacts/ContactJobs.svelte';
  import Button from '../components/ui/Button.svelte';
  const contactId = $derived(router.params.contactId || '');
  let resource = $state<ReadState<Contact>>({ status: 'loading' });
  let deleting = $state(false);
  let saving = $state(false);
  let deleteError = $state('');
  let generation = 0;
  $effect(() => { void _load(contactId); return () => { generation++; }; });
  async function _load(id: string): Promise<void> {
    const request = ++generation;
    resource = { status: 'loading' }; deleteError = '';
    try { const data = await api.getContact(id); if (request === generation) resource = { status: 'ready', data }; }
    catch (err) { if (request === generation) resource = { status: 'error', error: err instanceof ApiClientError && err.status === 404 ? 'Contato não encontrado.' : err instanceof Error ? err.message : 'Falha ao carregar contato.' }; }
  }
  async function _saved(contact: Contact): Promise<void> { if (contact.id === contactId) resource = { status: 'ready', data: contact }; }
  async function _delete(): Promise<void> {
    if (deleting || saving || resource.status !== 'ready') return;
    const contact = resource.data;
    if (!confirm(`Excluir o contato "${contact.name}"? A exclusão será bloqueada se houver agendamentos ativos para este número.`)) return;
    deleting = true; deleteError = '';
    try { await api.deleteContact(contact.id); }
    catch (err) { if (contact.id === contactId) deleteError = err instanceof ApiClientError && err.status === 409 ? 'Este contato possui agendamentos ativos. Cancele-os antes de excluir.' : err instanceof Error ? err.message : 'Falha ao excluir contato.'; deleting = false; return; }
    deleting = false;
    toast.success('Contato excluído.');
    if (contact.id === contactId) router.navigate('/contacts');
  }
</script>
<div id="scr-contact" class="grid gap-6" data-state={resource.status}>
  <nav aria-label="Navegação estrutural"><a class="text-accent underline" href="/contacts">Voltar para Contatos</a></nav>
  {#if resource.status === 'loading'}<p role="status">Carregando contato…</p>
  {:else if resource.status === 'error'}<p role="alert" class="text-error">{resource.error}</p><Button onclick={() => _load(contactId)}>Tentar novamente</Button>
  {:else}
    <header id="wdg-contact-header" class="ui-panel flex flex-wrap items-start justify-between gap-4"><div class="min-w-0 break-words"><h1 class="text-3xl font-semibold">{resource.data.name}</h1><p>{resource.data.phone}</p><p class="ui-hint">{resource.data.id}</p></div><Button id="btn-delete-contact" variant="danger" onclick={_delete} disabled={deleting || saving}>{deleting ? 'Excluindo…' : 'Excluir contato'}</Button></header>
    {#if deleteError}<p role="alert" class="text-error">{deleteError}</p>{/if}
    {#key resource.data.id}<ContactForm contact={resource.data} disabled={deleting} onbusy={(busy) => (saving = busy)} onsaved={_saved} />{/key}
    {#key `${resource.data.id}:${resource.data.phone}`}<ContactJobs contact={resource.data} />{/key}
  {/if}
</div>
