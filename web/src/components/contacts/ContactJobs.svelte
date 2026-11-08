<script lang="ts">
  import { api } from '../../lib/api';
  import type { Contact, JobListFilter, JobListItem } from '../../lib/types';
  import { formatDate, type ReadState } from '../../lib/jobs/agenda';
  import JobSummary from '../jobs/JobSummary.svelte';
  import JobActions from '../jobs/JobActions.svelte';
  import JobInspector from '../jobs/JobInspector.svelte';
  import JobComposer from '../jobs/JobComposer.svelte';
  import Button from '../ui/Button.svelte';
  let { contact }: { contact: Contact } = $props();
  let resource = $state<ReadState<JobListItem[]>>({ status: 'loading' });
  let status = $state<JobListFilter>('upcoming');
  let selectedId = $state<string | null>(null);
  let revision = $state(0);
  let generation = 0;
  $effect(() => { void _load(contact.phone, status); return () => { generation++; }; });
  async function _load(phone: string, filter: JobListFilter): Promise<void> {
    const request = ++generation;
    resource = { status: 'loading' };
    try {
      const data = await api.getJobs({ phone, status: filter });
      if (request === generation) { resource = { status: 'ready', data }; revision++; }
    } catch (err) { if (request === generation) resource = { status: 'error', error: err instanceof Error ? err.message : 'Falha ao carregar recados.' }; }
  }
  async function _refresh(): Promise<void> { await _load(contact.phone, status); }
  function _inspect(id: string): void { selectedId = id; }
</script>
<div class="grid gap-6">
  <JobComposer inline recipient={contact.phone} createdBy={contact.phone} oncreated={_refresh} />
  <div class="contact-agenda" data-inspecting={selectedId !== null}>
    <section id="wdg-job-list" class="ui-panel grid gap-4 content-start min-w-0" data-state={resource.status === 'ready' && !resource.data.length ? 'empty' : resource.status}>
      <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold text-xl">Recados deste contato</h2><Button onclick={_refresh} disabled={resource.status === 'loading'}>Atualizar recados</Button></div>
      <p class="ui-hint">Destinatário ou criador corresponde a {contact.phone}. Lista limitada aos registros retornados pelo servidor.</p>
      <div class="ui-field"><label for="contact-jobs-status">Estado dos recados</label><select id="contact-jobs-status" class="ui-input" bind:value={status}><option value="upcoming">Ativos (upcoming)</option><option value="all">Todos (all)</option><option value="paused">Pausados</option><option value="done">Concluídos</option><option value="error">Com erro</option></select></div>
      {#if resource.status === 'loading'}<p role="status">Carregando recados…</p>
      {:else if resource.status === 'error'}<p role="alert" class="text-error">{resource.error}</p><Button onclick={_refresh}>Tentar carregar recados</Button>
      {:else if !resource.data.length}<p class="ui-hint">Nenhum recado neste filtro.</p>
      {:else}{#each resource.data as job (job.id)}<article id="job-card-{job.id}" class="job-card" aria-current={selectedId === job.id ? 'true' : undefined}>
        <p class="ui-hint">{job.target_number === contact.phone || job.to === contact.phone ? 'Para este contato' : 'Criado por este contato'}</p>
        <JobSummary {job} contacts={[contact]} oninspect={_inspect} /><p class="tabular-nums">{formatDate(job.next_run_at || job.run_at)}</p>
        <details><summary>Ações do recado</summary><JobActions {job} onchange={_refresh} anchors={false} compact /></details>
      </article>{/each}{/if}
    </section>
    {#if selectedId}<JobInspector jobId={selectedId} refreshKey={revision} onclose={() => (selectedId = null)} oninspect={_inspect} onchange={_refresh} />{/if}
  </div>
</div>
<style>
  .contact-agenda { display: grid; gap: 16px; min-width: 0; }
  .job-card { display: grid; gap: 8px; padding: 16px; border: 1px solid rgb(var(--separator)); border-radius: 12px; }
  .job-card[aria-current='true'] { border-color: rgb(var(--accent)); }
  summary { min-height: 44px; padding: 8px; cursor: pointer; color: rgb(var(--accent)); }
  summary:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 2px; }
  @media (min-width: 1024px) { .contact-agenda[data-inspecting='true'] { grid-template-columns: minmax(0, 7fr) minmax(340px, 5fr); } }
</style>
