<script lang="ts">
  import { api } from '../lib/api';
  import { saveCsv } from '../lib/jobs/agenda';
  import Button from '../components/ui/Button.svelte';
  import ImportPanel from '../components/data/ImportPanel.svelte';
  import IntegrityPanel from '../components/data/IntegrityPanel.svelte';
  let includeRuns = $state(true);
  let busy = $state<'database' | 'json' | null>(null);
  let error = $state('');
  let message = $state('');
  async function _download(kind: 'database' | 'json'): Promise<void> {
    if (busy) return;
    busy = kind; error = ''; message = '';
    try {
      const blob = kind === 'database' ? await api.downloadDatabase() : new Blob([JSON.stringify(await api.exportData(includeRuns), null, 2)], { type: 'application/json' });
      saveCsv(blob, `homelab-schedule-${new Date().toISOString().replace(/[:.]/g, '-')}.${kind === 'database' ? 'sqlite3' : 'json'}`);
      message = kind === 'database' ? 'Snapshot SQLite baixado.' : 'Exportação JSON concluída.';
    } catch (err) { error = err instanceof Error ? err.message : 'Falha ao baixar arquivo.'; }
    finally { busy = null; }
  }
</script>
<div id="scr-data" class="grid gap-6 min-w-0">
  <header><h1 class="text-[28px] font-semibold">Dados</h1><p class="ui-hint">Guarde uma cópia, transfira registros ou verifique a integridade da agenda.</p></header>
  <div class="data-layout">
    <section class="ui-panel grid gap-4" aria-labelledby="snapshot-title"><div><h2 id="snapshot-title" class="text-xl font-semibold">Snapshot físico</h2><p class="ui-hint">Baixe uma cópia consistente do banco SQLite, incluindo o histórico retido.</p></div><Button id="btn-download-sqlite" disabled={busy !== null} onclick={() => _download('database')}>{busy === 'database' ? 'Gerando…' : 'Baixar .sqlite3'}</Button></section>
    <section class="ui-panel grid gap-4" aria-labelledby="export-title"><div><h2 id="export-title" class="text-xl font-semibold">Exportar JSON</h2><p class="ui-hint">Contatos, modelos e agendamentos SQLite. Rotinas YAML ficam no arquivo de origem.</p></div><label class="flex gap-2 items-center min-h-11"><input type="checkbox" bind:checked={includeRuns} disabled={busy !== null} />Incluir histórico de execuções</label><Button id="btn-export-json" disabled={busy !== null} onclick={() => _download('json')}>{busy === 'json' ? 'Exportando…' : 'Exportar arquivo JSON'}</Button></section>
  </div>
  {#if error}<p role="alert" class="text-error">{error}</p>{/if}
  {#if message}<p role="status">{message}</p>{/if}
  <ImportPanel />
  <IntegrityPanel />
</div>
<style>.data-layout { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px; }</style>
