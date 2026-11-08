<script lang="ts">
  import { tick } from 'svelte';
  import { api, ApiClientError } from '../../lib/api';
  import { toast } from '../../lib/toast.svelte';
  import type { MessageTemplate } from '../../lib/types';
  import PlaceholderTools from './PlaceholderTools.svelte';
  import Button from '../ui/Button.svelte';
  let { selected, disabled = false, onsaved, onreset, onbusy }: { selected: MessageTemplate | null; disabled?: boolean; onsaved: () => Promise<void>; onreset: () => void; onbusy: (busy: boolean) => void } = $props();
  let name = $state('');
  let body = $state('');
  let busy = $state(false);
  let error = $state('');
  let textarea = $state<HTMLTextAreaElement | null>(null);
  $effect(() => { name = selected?.name ?? ''; body = selected?.body ?? ''; error = ''; });
  function _reset(): void { if (busy || disabled) return; name = ''; body = ''; error = ''; onreset(); }
  async function _insert(tag: string): Promise<void> {
    if (busy || disabled) return;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    body = body.slice(0, start) + tag + body.slice(end);
    await tick();
    if (!textarea?.isConnected || busy || disabled) return;
    textarea.focus(); textarea.setSelectionRange(start + tag.length, start + tag.length);
  }
  async function _submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || disabled) return;
    const cleanName = name.trim();
    const cleanBody = body.trim();
    if (!cleanName || cleanName.length > 80 || !cleanBody) { error = 'Informe nome (até 80 caracteres) e mensagem.'; return; }
    busy = true; onbusy(true); error = '';
    try {
      if (selected) await api.patchTemplate(selected.id, { name: cleanName, body: cleanBody });
      else await api.createTemplate({ name: cleanName, body: cleanBody });
    } catch (err) { error = err instanceof ApiClientError && err.status === 409 ? 'Já existe um modelo com este nome.' : err instanceof Error ? err.message : 'Falha ao salvar modelo.'; busy = false; onbusy(false); return; }
    toast.success(selected ? 'Modelo atualizado.' : 'Modelo criado.');
    name = ''; body = ''; onreset();
    try { await onsaved(); } catch { error = 'Modelo salvo. Falha ao atualizar o catálogo; atualize antes de repetir.'; }
    finally { busy = false; onbusy(false); }
  }
</script>
<section id="wdg-template-form" class="ui-panel grid gap-4 min-w-0">
  <div class="flex flex-wrap items-center justify-between gap-2"><h2 id="form-title" class="font-semibold text-xl">{selected ? 'Editar modelo' : 'Novo modelo'}</h2><Button id="btn-reset-form" disabled={busy || disabled} onclick={_reset}>{selected ? 'Cancelar edição' : 'Limpar formulário'}</Button></div>
  <form id="template-editor-form" class="grid gap-4" onsubmit={_submit} data-state={busy ? 'busy' : error ? 'error' : 'ready'}>
    <fieldset disabled={busy || disabled} class="grid gap-4">
      <div class="ui-field"><label for="template-name-input">Nome do modelo <span id="name-counter" class="ui-hint tabular-nums">{name.length}/80</span></label><input id="template-name-input" name="name" class="ui-input" required maxlength="80" bind:value={name} /></div>
      <div class="ui-field"><label for="template-body-input">Mensagem <span id="body-counter" class="ui-hint tabular-nums">{body.length} caracteres</span></label><textarea id="template-body-input" name="body" class="ui-input" rows="7" required bind:value={body} bind:this={textarea}></textarea></div>
    </fieldset>
    {#if error}<p role="alert" class="text-error">{error}</p>{/if}
    <Button id="btn-submit-template" variant="primary" type="submit" disabled={busy || disabled}><span id="submit-btn-label">{busy ? 'Salvando…' : selected ? 'Salvar alterações' : 'Criar modelo'}</span></Button>
  </form>
  <PlaceholderTools {body} disabled={busy || disabled} oninsert={_insert} />
</section>
