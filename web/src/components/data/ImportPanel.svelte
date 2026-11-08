<script lang="ts">
  import { api } from '../../lib/api';
  import type { ImportDataRequest, ImportDataResponse, ImportMode } from '../../lib/types';
  import { parseImport } from './import';
  import Button from '../ui/Button.svelte';
  import Dialog from '../ui/Dialog.svelte';
  let mode = $state<ImportMode>('merge');
  let payload = $state<ImportDataRequest | null>(null);
  let result = $state<ImportDataResponse | null>(null);
  let error = $state('');
  let reading = $state(false);
  let busy = $state(false);
  let confirming = $state(false);
  let input: HTMLInputElement;
  let generation = 0;
  const labels = { contacts: 'Contatos', templates: 'Modelos', jobs: 'Agendamentos', job_runs: 'Execuções' } as const;
  $effect(() => () => { generation++; });
  async function _file(event: Event): Promise<void> {
    const request = ++generation;
    payload = null; result = null; error = ''; confirming = false;
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) { reading = false; return; }
    reading = true;
    try { const parsed = parseImport(await file.text()); if (request === generation) payload = parsed; }
    catch (err) { if (request === generation) error = err instanceof SyntaxError ? 'Arquivo JSON inválido ou corrompido.' : err instanceof Error ? err.message : 'Falha ao ler arquivo.'; }
    finally { if (request === generation) reading = false; }
  }
  function _close(): void { if (!busy) confirming = false; }
  async function _execute(): Promise<void> {
    if (!payload || busy || (mode === 'replace' && !confirming)) return;
    busy = true; error = ''; result = null;
    try {
      result = await api.importData({ ...payload, mode });
      payload = null; input.value = ''; confirming = false;
    } catch (err) { error = err instanceof Error ? err.message : 'Falha ao importar dados.'; confirming = false; }
    finally { busy = false; }
  }
</script>
<section class="ui-panel grid gap-4 min-w-0" aria-labelledby="import-title" data-state={busy || reading ? 'loading' : error ? 'error' : 'ready'}>
  <div><h2 id="import-title" class="text-xl font-semibold">Importar JSON</h2><p class="ui-hint">Confira os registros antes de importar. O servidor valida os dados e as referências. Rotinas YAML são mantidas.</p></div>
  <fieldset disabled={busy} class="grid gap-4 min-w-0">
    <legend class="mb-2">Estratégia de importação</legend>
    <label class="flex items-center gap-2 min-h-11"><input type="radio" name="importMode" value="merge" bind:group={mode} />Mesclar — atualizar ou inserir</label>
    <label class="flex items-center gap-2 min-h-11"><input type="radio" name="importMode" value="replace" bind:group={mode} />Substituir — apagar dados SQLite anteriores</label>
    <label for="input-import-file">Selecionar arquivo JSON</label>
    <input bind:this={input} id="input-import-file" class="ui-input w-full min-w-0" type="file" accept=".json,application/json" onchange={_file} />
  </fieldset>
  {#if reading}<p role="status">Lendo arquivo…</p>{/if}
  {#if error}<p role="alert" class="text-error break-words">{error}</p>{/if}
  {#if payload}<div aria-label="Resumo do arquivo" class="grid grid-cols-2 gap-4 tabular-nums bg-primary/10 p-space-md rounded-lg">{#each Object.entries(labels) as [key, label]}<p>{label}: <strong>{payload[key as keyof typeof labels]?.length ?? 0}</strong></p>{/each}</div>
    <Button id="btn-execute-import" variant={mode === 'replace' ? 'danger' : 'primary'} disabled={busy || reading} onclick={() => { if (mode === 'replace') confirming = true; else void _execute(); }}>{busy ? 'Importando…' : mode === 'replace' ? 'Revisar substituição' : 'Processar importação'}</Button>
  {/if}
  {#if result}<div role="status" class="grid gap-2" id="import-result"><h3>Importação concluída</h3><p class="ui-hint">As listas serão atualizadas ao abrir Agenda, Contatos, Modelos ou Histórico.</p>
    {#each Object.entries(labels) as [key, label]}{@const counts = result.summary[key as keyof typeof labels]}<p>{label}: {counts.created} criados, {counts.updated} atualizados, {counts.skipped} ignorados.</p>{/each}
    {#if result.warnings.length}<h3>Avisos</h3><ul>{#each result.warnings as warning}<li class="break-words">{warning}</li>{/each}</ul>{/if}
  </div>{/if}
</section>
{#if confirming}<Dialog id="replace-confirm" title="Confirmar substituição" description="Os dados SQLite anteriores serão apagados. Rotinas YAML são mantidas. Deseja continuar?" onclose={_close}>
  <div class="flex flex-wrap gap-2"><Button disabled={busy} onclick={_close}>Cancelar substituição</Button><Button variant="danger" disabled={busy} onclick={_execute}>{busy ? 'Importando…' : 'Confirmar substituição'}</Button></div>
</Dialog>{/if}
