<script lang="ts">
  import { api, ApiClientError } from '../../lib/api';
  import { toast } from '../../lib/toast.svelte';
  import type { Contact, UpdateContactRequest } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  let { contact = null, disabled = false, onbusy = () => {}, onsaved }: { contact?: Contact | null; disabled?: boolean; onbusy?: (busy: boolean) => void; onsaved: (contact: Contact) => Promise<void> } = $props();
  let name = $state('');
  let phone = $state('');
  let busy = $state(false);
  let error = $state('');
  const editing = $derived(contact !== null);
  $effect(() => { name = contact?.name ?? ''; phone = contact?.phone ?? ''; error = ''; });
  function _reset(): void { if (busy || disabled) return; name = contact?.name ?? ''; phone = contact?.phone ?? ''; error = ''; }
  async function _submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || disabled) return;
    const payload: UpdateContactRequest = {};
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || !cleanPhone || cleanName.length > 80 || cleanPhone.length > 64) { error = 'Informe nome (até 80 caracteres) e telefone (até 64 caracteres).'; return; }
    if (cleanName !== contact?.name) payload.name = cleanName;
    if (cleanPhone !== contact?.phone) payload.phone = cleanPhone;
    if (!Object.keys(payload).length) { toast.info('Nenhuma alteração detectada.'); return; }
    busy = true; onbusy(true); error = '';
    let saved: Contact;
    try { saved = contact ? await api.patchContact(contact.id, payload) : await api.createContact({ name: cleanName, phone: cleanPhone }); }
    catch (err) { error = err instanceof ApiClientError && err.status === 409 ? 'Este nome ou telefone já está cadastrado.' : err instanceof Error ? err.message : 'Falha ao salvar contato.'; busy = false; onbusy(false); return; }
    toast.success(editing ? 'Contato atualizado.' : 'Contato adicionado.');
    if (!editing) { name = ''; phone = ''; }
    try { await onsaved(saved); } catch { error = 'Contato salvo. Falha ao atualizar a lista; atualize antes de repetir.'; }
    finally { busy = false; onbusy(false); }
  }
</script>
<section id={editing ? 'wdg-contact-edit' : 'wdg-contact-create'} class="ui-panel grid gap-4">
  <div><h2 class="font-semibold text-xl">{editing ? 'Editar contato' : 'Novo contato'}</h2><p class="ui-hint">Nome e telefone devem ser únicos.{editing ? ' Alterar o telefone recarrega os recados vinculados.' : ''}</p></div>
  <form id={editing ? 'form-edit-contact' : 'form-create-contact'} onsubmit={_submit} class="grid gap-4" data-state={busy ? 'busy' : error ? 'error' : 'ready'}>
    <fieldset disabled={busy || disabled} class="grid gap-4">
      <div class="ui-field"><label for={editing ? 'input-edit-name' : 'contact-name'}>Nome</label><input id={editing ? 'input-edit-name' : 'contact-name'} name="name" class="ui-input" required maxlength="80" autocomplete="name" bind:value={name} /></div>
      <div class="ui-field"><label for={editing ? 'input-edit-phone' : 'contact-phone'}>Telefone</label><input id={editing ? 'input-edit-phone' : 'contact-phone'} name="phone" type="tel" class="ui-input" required maxlength="64" autocomplete="tel" bind:value={phone} /></div>
    </fieldset>
    {#if error}<p id={editing ? 'contact-edit-feedback' : 'api-feedback'} role="alert" class="text-error">{error}</p>{/if}
    <div class="flex flex-wrap gap-2"><Button id={editing ? 'btn-save-contact' : 'btn-submit-contact'} variant="primary" type="submit" disabled={busy || disabled}>{busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar contato'}</Button><Button onclick={_reset} disabled={busy || disabled}>{editing ? 'Descartar' : 'Limpar'}</Button></div>
  </form>
</section>
