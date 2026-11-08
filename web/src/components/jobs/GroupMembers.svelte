<script lang="ts">
  import { api } from '../../lib/api';
  import type { JobListItem } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  import JobActions from './JobActions.svelte';
  let { groupId, oninspect, onchange }: { groupId: string; oninspect: (id: string) => void; onchange: () => Promise<void> } = $props();
  let members = $state<JobListItem[]>([]);
  let loading = $state(true);
  let error = $state('');
  let generation = 0;
  $effect(() => { void _load(groupId); return () => { generation++; }; });
  async function _load(id: string): Promise<void> {
    const request = ++generation;
    loading = true; error = '';
    try {
      const result = await api.getJobs({ status: 'all', group_id: id, limit: 100 });
      if (request === generation) members = result;
    } catch (err) {
      if (request === generation) error = err instanceof Error ? err.message : 'Falha ao carregar membros.';
    } finally { if (request === generation) loading = false; }
  }
</script>
<section id="detail-group-section" data-group-id={groupId} data-state={loading ? 'loading' : error ? 'error' : members.length ? 'ready' : 'empty'}>
  <div id="detail-group-card"><h3>Grupo de envio</h3><p id="detail-group-id">{groupId}</p></div><p class="ui-hint">Até 100 membros carregados; esta lista pode ser um subconjunto do grupo. Ações de grupo usam o grupo inteiro conforme elegibilidade do servidor.</p>
  <Button disabled={loading} onclick={() => _load(groupId)}>Atualizar membros</Button>
  {#if loading}<p role="status">Carregando membros…</p>
  {:else if error}<p role="alert" class="text-error">{error}</p>
  {:else if !members.length}<p>Nenhum membro encontrado.</p>
  {:else}
    <JobActions job={members.find(member => member.source === 'sqlite') ?? members[0]} {groupId} {onchange} />
    <ul id="group-members-list" class="grid gap-2">{#each members as member (member.id)}<li><Button onclick={() => oninspect(member.id)}>{member.title} · {member.target_number || member.to} · {member.status}</Button></li>{/each}</ul>
  {/if}
</section>
