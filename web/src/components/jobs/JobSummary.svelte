<script lang="ts">
  import type { Contact, JobListItem } from '../../lib/types';
  import { recipientContact, statusLabels } from '../../lib/jobs/agenda';
  import StatusBadge from '../ui/StatusBadge.svelte';
  let { job, contacts, oninspect }: { job: JobListItem; contacts: Contact[]; oninspect: (id: string) => void } = $props();
  const contact = $derived(recipientContact(job, contacts));
</script>
<div class="grid gap-2 min-w-0">
  <button type="button" class="job-title" onclick={() => oninspect(job.id)}>{job.title}</button>
  <div class="flex flex-wrap gap-2"><StatusBadge tone={job.status === 'error' ? 'error' : job.status === 'done' ? 'success' : 'neutral'}>{statusLabels[job.status]}</StatusBadge><span class="ui-hint">{job.source === 'yaml' ? 'YAML · edite routines.yaml' : 'SQLite'} · {job.kind === 'cron' ? 'Recorrente' : 'Uma vez'}</span></div>
  <p class="text-sm">Para: {#if contact}<a class="text-accent underline" href="/contacts/{contact.id}">{contact.name}</a> · {/if}{job.to !== job.target_number ? `${job.to} · ` : ''}{job.target_number || job.to}</p>
  {#if job.created_by}<p class="ui-hint">Criado por: {job.created_by}</p>{/if}
  <div class="flex flex-wrap gap-2 text-sm">
    {#each job.tags ?? [] as tag}<span class="rounded-lg bg-fill px-2 py-1" data-testid="badge-tag">{tag}</span>{/each}
    {#if Object.keys(job.variables ?? {}).length}<span class="ui-hint" data-testid="badge-variable-count">{Object.keys(job.variables ?? {}).length} variável(is)</span>{/if}
    {#if job.template_id}<span class="ui-hint">Modelo: {job.template_id}</span>{/if}
  </div>
  {#if job.last_error}<p class="text-error text-sm">Falha: {job.last_error} · {job.retry_count ?? 0} tentativa(s)</p>{/if}
</div>
<style>
  .job-title { color: rgb(var(--accent)); font-weight: 650; text-align: left; min-height: 44px; overflow-wrap: anywhere; border-radius: 8px; }
  .job-title:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 2px; }
</style>
