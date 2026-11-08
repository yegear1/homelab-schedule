<script lang="ts">
  import type { Contact, JobListItem } from '../../lib/types';
  import { formatDate, groupJobs, statusLabels } from '../../lib/jobs/agenda';
  import JobSummary from './JobSummary.svelte';
  import JobActions from './JobActions.svelte';
  import Button from '../ui/Button.svelte';
  let { jobs, contacts, selectedId, oninspect, onchange }: { jobs: JobListItem[]; contacts: Contact[]; selectedId: string | null; oninspect: (id: string) => void; onchange: () => Promise<void> } = $props();
  let expandedGroups = $state(new Set<string>());
  const rows = $derived(groupJobs(jobs));
  const groupIds = $derived(rows.flatMap(row => row.type === 'group' ? [row.groupId] : []));
  const isAllExpanded = $derived(groupIds.length > 0 && groupIds.every(id => expandedGroups.has(id)));
  function _toggleGroup(id: string): void {
    const next = new Set(expandedGroups);
    if (next.has(id)) next.delete(id); else next.add(id);
    expandedGroups = next;
  }
  function _toggleAll(): void { expandedGroups = isAllExpanded ? new Set() : new Set(groupIds); }
</script>
{#snippet timing(job: JobListItem)}
  <div class="grid gap-2 tabular-nums text-sm"><span>{formatDate(job.next_run_at || job.run_at)}</span>{#if job.cron_expr}<code>{job.cron_expr}</code>{/if}{#if job.until}<span class="ui-hint">Até {formatDate(job.until)}</span>{/if}{#if job.max_runs}<span class="ui-hint">{job.run_count ?? 0} / {job.max_runs} execuções</span>{/if}</div>
{/snippet}
{#snippet item(job: JobListItem, member = false)}
  <tr data-job-id={job.id} data-group-id={job.group_id ?? undefined} aria-current={selectedId === job.id ? 'true' : undefined}>
    <td>{#if member}<span class="ui-hint">Membro do grupo</span>{/if}<JobSummary {job} {contacts} {oninspect} /></td>
    <td>{@render timing(job)}</td>
    <td><details><summary>Ações do recado</summary><JobActions {job} {onchange} anchors={false} compact /></details></td>
  </tr>
{/snippet}
<div class="grid gap-4">
  {#if groupIds.length}<div class="flex flex-wrap items-center gap-2"><Button id="btn-toggle-all-groups" onclick={_toggleAll}>{isAllExpanded ? 'Recolher todos' : 'Expandir todos'}</Button><span class="ui-hint">{groupIds.length} grupo(s) na lista. Contagens refletem apenas os membros carregados.</span></div>{/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="table-scroll" role="region" aria-label="Tabela de agendamentos" tabindex="0">
    <table aria-label="Agendamentos">
      <colgroup><col style="width: 44%" /><col style="width: 26%" /><col style="width: 30%" /></colgroup>
      <thead><tr><th scope="col">Agendamento e destinatário</th><th scope="col">Próxima execução</th><th scope="col">Ações</th></tr></thead>
      <tbody id="job-table-body">
        {#each rows as row (row.type === 'group' ? `group-${row.groupId}` : row.job.id)}
          {#if row.type === 'single'}{@render item(row.job)}
          {:else}
            <tr data-group-id={row.groupId} class="group-row">
              <td><JobSummary job={row.items[0]} {contacts} {oninspect} /><p class="ui-hint">Grupo · {row.items.length} membro(s) carregado(s)</p>
                <p class="ui-hint">{Object.entries(statusLabels).map(([status, label]) => `${row.items.filter(job => job.status === status).length} ${label.toLowerCase()}`).join(' · ')}</p>
                <Button aria-expanded={expandedGroups.has(row.groupId)} aria-label="{expandedGroups.has(row.groupId) ? 'Recolher' : 'Expandir'} grupo {row.groupId}" onclick={() => _toggleGroup(row.groupId)}>{expandedGroups.has(row.groupId) ? 'Recolher grupo' : 'Expandir grupo'}</Button>
              </td>
              <td>{@render timing(row.items[0])}<p class="ui-hint">Horário do primeiro membro carregado.</p></td>
              <td><details><summary>Ações do grupo</summary><p class="ui-hint">Aplicadas a todo o grupo conforme elegibilidade do servidor.</p><JobActions job={row.items.find(job => job.source === 'sqlite') ?? row.items[0]} groupId={row.groupId} {onchange} anchors={false} compact /></details></td>
            </tr>
            {#if expandedGroups.has(row.groupId)}{#each row.items as job (job.id)}{@render item(job, true)}{/each}{/if}
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
</div>
<style>
  .table-scroll { overflow-x: auto; max-width: 100%; border: 1px solid rgb(var(--separator)); border-radius: 12px; }
  table { width: 100%; min-width: 900px; table-layout: fixed; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; vertical-align: top; padding: 16px; border-bottom: 1px solid rgb(var(--separator)); overflow-wrap: anywhere; }
  th { color: rgb(var(--secondary-label)); font-weight: 600; background: rgb(var(--fill) / .5); }
  tr[aria-current='true'] { box-shadow: inset 3px 0 rgb(var(--accent)); background: rgb(var(--accent) / .08); }
  .group-row { background: rgb(var(--fill) / .4); }
  summary { min-height: 44px; cursor: pointer; color: rgb(var(--accent)); display: list-item; padding: 8px; border-radius: 8px; }
  summary:focus-visible, .table-scroll:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 2px; }
</style>
