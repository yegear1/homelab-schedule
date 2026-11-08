<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiClientError } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import type { MessageTemplate } from '../lib/types';
  import type { ReadState } from '../lib/jobs/agenda';
  import TemplateEditor from '../components/templates/TemplateEditor.svelte';
  import Button from '../components/ui/Button.svelte';
  let resource = $state<ReadState<MessageTemplate[]>>({ status: 'loading' });
  let search = $state('');
  let selected = $state<MessageTemplate | null>(null);
  let saving = $state(false);
  let deleting = $state<string | null>(null);
  let deleteError = $state('');
  let generation = 0;
  const templates = $derived(resource.status === 'ready' ? resource.data : []);
  const filtered = $derived(templates.filter(template => [template.name, template.body, template.id].some(value => value.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))));
  onMount(() => { void _load(); return () => { generation++; }; });
  async function _load(): Promise<void> {
    const request = ++generation;
    resource = { status: 'loading' };
    try { const data = await api.getTemplates(); if (request === generation) resource = { status: 'ready', data }; }
    catch (err) { if (request === generation) resource = { status: 'error', error: err instanceof Error ? err.message : 'Falha ao carregar modelos.' }; }
  }
  function _edit(template: MessageTemplate): void {
    if (saving || deleting) return;
    selected = template;
    requestAnimationFrame(() => { document.getElementById('template-name-input')?.focus({ preventScroll: true }); document.getElementById('wdg-template-form')?.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  }
  async function _delete(template: MessageTemplate): Promise<void> {
    if (saving || deleting || !confirm(`Excluir o modelo "${template.name}"?`)) return;
    deleting = template.id; deleteError = '';
    try { await api.deleteTemplate(template.id); }
    catch (err) { deleteError = err instanceof ApiClientError && err.status === 409 ? 'Este modelo possui agendamentos ativos e não pode ser excluído. Cancele os agendamentos vinculados primeiro.' : err instanceof Error ? err.message : 'Falha ao excluir modelo.'; deleting = null; return; }
    if (selected?.id === template.id) selected = null;
    toast.success('Modelo excluído.');
    await _load(); deleting = null;
  }
</script>
<div id="scr-templates" class="grid gap-6" data-state={resource.status}>
  <header class="flex flex-wrap items-start justify-between gap-4"><div><h1 class="text-3xl font-semibold">Modelos de mensagem</h1><p class="ui-hint">Textos reutilizáveis com variáveis preenchidas no disparo.</p><p id="val-total-templates" class="ui-hint tabular-nums">{resource.status === 'ready' ? `${templates.length} modelo(s) no catálogo` : 'Catálogo não carregado'}</p></div><Button onclick={_load} disabled={resource.status === 'loading' || saving || deleting !== null}>Atualizar modelos</Button></header>
  {#if deleteError}<div id="delete-conflict-alert" role="alert" class="text-error"><p id="delete-conflict-msg">{deleteError}</p></div>{/if}
  <div class="templates-layout">
    <section id="wdg-template-list" class="ui-panel grid gap-4 content-start min-w-0" data-state={resource.status === 'ready' && !filtered.length ? 'empty' : resource.status}>
      <div class="flex flex-wrap justify-between gap-2"><h2 class="font-semibold text-xl">Catálogo</h2><span id="badge-template-count" class="ui-hint tabular-nums">{resource.status === 'ready' ? `${filtered.length} de ${templates.length}` : '—'}</span></div>
      <div class="ui-field"><label for="filter-template-input">Buscar nome, ID ou mensagem</label><input id="filter-template-input" class="ui-input" type="search" bind:value={search} /></div>
      {#if resource.status === 'loading'}<p role="status">Carregando modelos…</p>
      {:else if resource.status === 'error'}<p role="alert" class="text-error">{resource.error}</p><Button onclick={_load}>Tentar novamente</Button>
      {:else if !filtered.length}<p class="ui-hint">{templates.length ? 'Nenhum modelo corresponde à busca.' : 'Nenhum modelo cadastrado. Crie o primeiro modelo no editor.'}</p>
      {:else}<ul id="template-card-container" class="grid gap-4">{#each filtered as template (template.id)}<li class="template-card" aria-current={selected?.id === template.id ? 'true' : undefined}>
        <strong>{template.name}</strong><p class="ui-hint">{template.id}</p><p class="template-body">{template.body}</p>
        <div class="flex flex-wrap gap-2"><Button disabled={saving || deleting !== null} onclick={() => _edit(template)} aria-label="Editar {template.name}">Editar</Button><Button variant="danger" disabled={saving || deleting !== null} onclick={() => _delete(template)} aria-label="Excluir {template.name}">{deleting === template.id ? 'Excluindo…' : 'Excluir'}</Button></div>
      </li>{/each}</ul>{/if}
    </section>
    <TemplateEditor {selected} disabled={deleting !== null} onsaved={_load} onreset={() => (selected = null)} onbusy={(busy) => (saving = busy)} />
  </div>
</div>
<style>
  .templates-layout { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 16px; align-items: start; min-width: 0; }
  .template-card { display: grid; gap: 8px; border: 1px solid rgb(var(--separator)); border-radius: 12px; padding: 16px; overflow-wrap: anywhere; }
  .template-card[aria-current='true'] { border-color: rgb(var(--accent)); }
  .template-body { white-space: pre-wrap; max-height: 160px; overflow-y: auto; }
</style>
