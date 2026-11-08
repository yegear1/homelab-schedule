<script lang="ts">
  import { api } from '../../lib/api';
  import type { IntegrityCheckResponse } from '../../lib/types';
  import Button from '../ui/Button.svelte';
  let busy = $state(false);
  let error = $state('');
  let result = $state<IntegrityCheckResponse | null>(null);
  async function _check(): Promise<void> {
    if (busy) return;
    busy = true; error = ''; result = null;
    try { result = await api.checkIntegrity(); }
    catch (err) { error = err instanceof Error ? err.message : 'Falha ao verificar integridade.'; }
    finally { busy = false; }
  }
</script>
<section class="ui-panel grid gap-4" aria-labelledby="integrity-title" data-state={busy ? 'loading' : error ? 'error' : 'ready'}>
  <div><h2 id="integrity-title" class="text-xl font-semibold">Integridade</h2><p class="ui-hint">Verifique o banco e as referências entre registros quando precisar.</p></div>
  <Button id="btn-check-integrity" disabled={busy} onclick={_check}>{busy ? 'Verificando…' : 'Executar checagem'}</Button>
  {#if error}<p role="alert" class="text-error">{error}</p>{/if}
  {#if result}<div role="status" class="grid gap-2 break-words">
    <p>Banco SQLite: <strong>{result.integrity_ok ? 'OK' : 'FALHA'}</strong></p>
    <p>Chaves estrangeiras: <strong>{result.foreign_keys_ok ? 'OK' : 'FALHA'}</strong></p>
    <ul>{#each result.details as detail}<li>{detail}</li>{/each}</ul>
    {#if result.fk_violations.length}<h3>Violações de referência</h3><ul>{#each result.fk_violations as violation}<li>{violation.table} · registro {violation.rowid} · referência {violation.parent} · chave {violation.fkid}</li>{/each}</ul>{/if}
  </div>{/if}
</section>
