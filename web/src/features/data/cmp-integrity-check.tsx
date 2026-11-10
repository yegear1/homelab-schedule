/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import type { IntegrityCheckResponse } from '../../lib/types';

export function IntegrityCheckCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<IntegrityCheckResponse | null>(null);

  const handleRunDiagnostics = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    // Clear stale results on run/retry
    setResult(null);

    try {
      const res = await api.checkIntegrity();
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao verificar integridade.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <div>
            <h2 id="integrity-title" className="text-base font-semibold text-foreground">
              Integridade
            </h2>
            <p className="text-xs text-muted-foreground">
              Verifique o banco e as referências entre registros quando precisar.
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-check-integrity"
          onClick={handleRunDiagnostics}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs shrink-0 self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
          <span>{busy ? 'Verificando…' : 'Executar checagem (Integridade)'}</span>
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-rose-500 font-medium">
          {error}
        </p>
      )}

      {result && (
        <div role="status" className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${result.integrity_ok ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-rose-500/20 bg-rose-500/10'}`}>
              <span className="font-semibold text-sm text-foreground block mb-1">
                PRAGMA integrity_check
              </span>
              <p className="text-xs font-mono">
                Banco SQLite: <strong className={result.integrity_ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{result.integrity_ok ? 'OK' : 'FALHA'}</strong>
              </p>
              {result.details && result.details.length > 0 && (
                <ul className="text-xs text-muted-foreground mt-2 list-disc list-inside">
                  {result.details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className={`p-4 rounded-xl border ${result.foreign_keys_ok ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-rose-500/20 bg-rose-500/10'}`}>
              <span className="font-semibold text-sm text-foreground block mb-1">
                PRAGMA foreign_key_check
              </span>
              <p className="text-xs font-mono">
                Chaves estrangeiras: <strong className={result.foreign_keys_ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{result.foreign_keys_ok ? 'OK' : 'FALHA'}</strong>
              </p>
              {result.fk_violations && result.fk_violations.length > 0 && (
                <div className="mt-2 space-y-1">
                  <h3 className="font-semibold text-rose-500">Violações de referência</h3>
                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                    {result.fk_violations.map((v, idx) => (
                      <li key={idx}>
                        {v.table} · registro {v.rowid} · referência {v.parent} · chave {v.fkid}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
