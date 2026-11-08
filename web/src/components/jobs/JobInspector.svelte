<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiClientError } from '../../lib/api';
  import { focusTrap } from '../../lib/focusTrap';
  import type { Job } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  import JobActions from './JobActions.svelte';
  import GroupMembers from './GroupMembers.svelte';
  import RunHistory from './RunHistory.svelte';
  import UpcomingRuns from './UpcomingRuns.svelte';
  let { jobId, refreshKey = 0, onclose, oninspect, onchange }: { jobId: string; refreshKey?: number; onclose: () => void; oninspect: (id: string) => void; onchange: () => Promise<void> } = $props();
  let job = $state<Job | null>(null);
  let loading = $state(true);
  let error = $state('');
  let mobile = $state(false);
  let revision = $state(0);
  let generation = 0;
  onMount(() => {
    const trigger = document.activeElement;
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected && !trigger.closest('[inert]')) trigger.focus({ preventScroll: true });
    };
  });
  $effect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    mobile = media.matches;
    const update = () => { mobile = media.matches; };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
  $effect(() => { void refreshKey; void _load(jobId); return () => { generation++; }; });
  async function _load(id: string): Promise<void> {
    const request = ++generation;
    loading = true; error = ''; job = null;
    try {
      const result = await api.getJob(id);
      if (request === generation) job = result;
    } catch (err) {
      if (request === generation) error = err instanceof ApiClientError && err.status === 404 ? 'Agendamento não encontrado.' : err instanceof Error ? err.message : 'Falha ao carregar detalhes.';
    } finally { if (request === generation) loading = false; }
  }
  async function _changed(): Promise<void> {
    const id = jobId;
    const previousRefresh = refreshKey;
    await onchange();
    if (id !== jobId) return;
    if (refreshKey === previousRefresh) await _load(id);
    revision++;
  }
  function _date(value: string | null | undefined): string { return value ? new Date(value).toLocaleString('pt-BR') : '—'; }
</script>

{#snippet content()}
  <header class="flex items-start justify-between gap-2">
    <div><h2 id="inspector-title">Detalhes do agendamento</h2><p id="detail-job-id" class="ui-hint"><span id="detail-job-id-badge">{jobId}</span></p></div>
    <Button variant="quiet" aria-label="Fechar inspeção" onclick={onclose}>Fechar</Button>
  </header>
  {#if loading}<p role="status">Carregando detalhes…</p>
  {:else if error}<p role="alert" class="text-error">{error}</p><Button onclick={() => _load(jobId)}>Tentar novamente</Button>
  {:else if job}
    <h3 id="detail-title">{job.title}</h3>
    <dl class="inspector-metadata tabular-nums">
      <div><dt>Estado</dt><dd id="detail-status">{({ scheduled: 'Agendado', paused: 'Pausado', done: 'Concluído', error: 'Erro' })[job.status]}</dd></div>
      <div><dt>Origem</dt><dd id="detail-source"><span id="detail-source-badge">{job.source === 'yaml' ? 'routines.yaml' : 'SQLite'}</span></dd></div>
      <div><dt>Destinatário</dt><dd id="detail-target">{job.to} · {job.target_number}</dd></div>
      <div><dt>Criador</dt><dd id="detail-created-by">{job.created_by || '—'}</dd></div>
      <div><dt>Tipo</dt><dd id="detail-kind">{job.kind}</dd></div>
      <div><dt>Regra / data</dt><dd id="detail-schedule">{job.cron_expr || _date(job.run_at)}</dd></div>
      <div><dt>Próxima execução</dt><dd id="detail-next-run">{_date(job.next_run_at)}</dd></div>
      <div><dt>Última execução</dt><dd id="detail-last-run">{_date(job.last_run_at)} · {job.last_status || 'Pendente'}</dd></div>
      <div><dt>Limite de data</dt><dd id="detail-until">{_date(job.until)}</dd></div>
      <div><dt>Execuções / limite</dt><dd id="detail-runs">{job.run_count ?? 0} / {job.max_runs ?? 'Sem limite'}</dd></div>
      <div><dt>Tentativas</dt><dd id="detail-retries">{job.retry_count}</dd></div>
      <div><dt>Modelo</dt><dd>{job.template_id || 'Texto direto'}</dd></div>
    </dl>
    {#if job.source === 'yaml'}<p id="detail-yaml-warning" class="ui-hint">Rotina declarativa. Edite routines.yaml para alterar ou cancelar; pausar, retomar, adiar e re-enfileirar estão indisponíveis pela API. Disparar agora continua disponível.</p>{/if}
    {#if job.status === 'error' || job.last_error}<section id="detail-dead-letter-box" class="rounded-xl bg-error/10 p-4"><h3>Falha na execução</h3><div id="detail-error-container"><p id="detail-dead-letter-error"><span id="detail-error-msg"><span id="detail-last-error">{job.last_error || 'Sem diagnóstico disponível.'}</span></span></p></div><p id="detail-dead-letter-retries">{job.retry_count} tentativa(s)</p></section>{/if}
    <JobActions {job} onchange={_changed} />
    <section><h3>Mensagem completa</h3><p id="detail-content" class="whitespace-pre-wrap rounded-xl bg-fill p-4">{job.content || '(vazio)'}</p></section>
    <section id="detail-tags-card"><h3>Tags</h3><p id="detail-tags-list">{job.tags?.join(' · ') || 'Sem tags'}</p></section>
    <section id="detail-variables-card"><h3>Variáveis</h3><dl id="detail-variables-list">{#each Object.entries(job.variables ?? {}) as [key, value]}<div><dt>{key}</dt><dd>{value}</dd></div>{:else}<p class="ui-hint">Sem variáveis personalizadas.</p>{/each}</dl></section>
    {#key `${job.id}:${revision}`}
      {#if job.group_id}<GroupMembers groupId={job.group_id} {oninspect} onchange={_changed} />{/if}
      <UpcomingRuns jobId={job.id} />
      <RunHistory jobId={job.id} />
    {/key}
  {/if}
{/snippet}

{#if mobile}
  <div class="inspector-backdrop">
    <div use:focusTrap={{ onclose }} class="inspector-panel" id="wdg-job-detail" role="dialog" aria-modal="true" aria-labelledby="inspector-title" tabindex="-1" data-state={loading ? 'loading' : error ? 'error' : 'ready'}>{@render content()}</div>
  </div>
{:else}
  <aside class="inspector-panel lg:col-span-5" id="wdg-job-detail" aria-labelledby="inspector-title" data-state={loading ? 'loading' : error ? 'error' : 'ready'}>{@render content()}</aside>
{/if}

<style>
  .inspector-panel { min-width: 0; align-self: start; display: grid; gap: 16px; padding: 24px; border: 1px solid rgb(var(--separator)); border-radius: 16px; background: rgb(var(--secondary-system-background)); color: rgb(var(--label)); overflow-wrap: anywhere; }
  .inspector-panel h2 { font-size: 20px; font-weight: 650; }
  .inspector-panel :global(h3) { font-weight: 600; }
  .inspector-metadata { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; font-size: 14px; }
  dt { color: rgb(var(--secondary-label)); }
  .inspector-backdrop { position: fixed; inset: 0; z-index: 40; background: rgb(var(--label) / .3); display: flex; align-items: end; padding: 8px; }
  .inspector-backdrop .inspector-panel { width: 100%; max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px); overflow-y: auto; overscroll-behavior: contain; align-self: end; padding-bottom: max(24px, env(safe-area-inset-bottom)); }
</style>
