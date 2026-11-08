<script lang="ts">
  import type { AgendaFilters } from '../../lib/jobs/agenda';
  import Button from '../ui/Button.svelte';
  let { draft = $bindable(), tags, error, onapply, onreset }: { draft: AgendaFilters; tags: string[]; error: string; onapply: () => void; onreset: () => void } = $props();
</script>
<section id="wdg-job-filters" class="ui-panel grid gap-4" aria-labelledby="filters-title">
  <div><h2 id="filters-title" class="font-semibold">Filtrar agenda</h2><p class="ui-hint">Período em horário local. Pessoa corresponde ao destinatário ou criador.</p></div>
  <form id="form-job-filters" class="grid gap-4" onsubmit={(event) => { event.preventDefault(); onapply(); }}>
    <div class="filter-grid">
      <div class="ui-field"><label for="filter-status">Estado</label><select id="filter-status" name="status" class="ui-input" bind:value={draft.status}><option value="upcoming">Agendados</option><option value="all">Todos</option><option value="paused">Pausados</option><option value="done">Concluídos</option><option value="error">Com erro</option></select></div>
      <div class="ui-field"><label for="filter-query">Buscar título ou mensagem</label><input id="filter-query" name="query" class="ui-input" bind:value={draft.query} type="search" /></div>
      <div class="ui-field"><label for="filter-phone">Pessoa, número ou alias</label><input id="filter-phone" name="phone" class="ui-input" bind:value={draft.phone} /></div>
      <div class="ui-field"><label for="filter-tag">Tag</label><input id="filter-tag" name="tag" class="ui-input" list="tags-datalist" bind:value={draft.tag} /><datalist id="tags-datalist">{#each tags as tag}<option value={tag}></option>{/each}</datalist></div>
      <div class="ui-field"><label for="filter-from">A partir de</label><input id="filter-from" name="from" class="ui-input" type="datetime-local" bind:value={draft.from} /></div>
      <div class="ui-field"><label for="filter-to">Até</label><input id="filter-to" name="to" class="ui-input" type="datetime-local" bind:value={draft.to} /></div>
      <div class="ui-field"><label for="filter-limit">Limite da lista</label><input id="filter-limit" name="limit" class="ui-input" type="number" min="1" max="100" step="1" required bind:value={draft.limit} /></div>
    </div>
    {#if error}<p role="alert" class="text-error">{error}</p>{/if}
    <div class="flex flex-wrap gap-2"><Button variant="primary" type="submit">Aplicar filtros</Button><Button id="btn-reset-filters" onclick={onreset}>Limpar filtros</Button></div>
  </form>
</section>
<style>
  .filter-grid { align-items: end; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 16px; }
</style>
