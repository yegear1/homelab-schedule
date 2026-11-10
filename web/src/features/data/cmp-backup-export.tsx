/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Database, FileDown, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

export function BackupExportCard() {
  const [includeRuns, setIncludeRuns] = useState(true);
  const [busy, setBusy] = useState<'database' | 'json' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleDownloadSqlite = async () => {
    if (busy) return;
    setBusy('database');
    setError('');
    setMessage('');

    try {
      const blob = await api.downloadDatabase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homelab-schedule-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage('Snapshot SQLite baixado.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao baixar snapshot.');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadJson = async () => {
    if (busy) return;
    setBusy('json');
    setError('');
    setMessage('');

    try {
      const bundle = await api.exportData(includeRuns);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homelab-schedule-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage('Exportação JSON concluída.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar dados.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-sky-500" />
          <h2 className="text-base font-semibold text-foreground">
            Backups e Exportação
          </h2>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-rose-500 font-medium">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-xs text-emerald-500 font-medium">
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Raw SQLite Snapshot */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-500" />
              <h3 id="snapshot-title" className="text-sm font-semibold text-foreground">
                Snapshot físico
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Baixe uma cópia consistente do banco SQLite, incluindo o histórico retido.
            </p>
          </div>

          <button
            type="button"
            id="btn-download-sqlite"
            onClick={handleDownloadSqlite}
            disabled={busy !== null}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs disabled:opacity-50"
          >
            {busy === 'database' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            <span>{busy === 'database' ? 'Gerando…' : 'Baixar .sqlite3 (Snapshot físico)'}</span>
          </button>
        </div>

        {/* 2. Standard JSON Data Bundle */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileDown className="h-4 w-4 text-emerald-500" />
              <h3 id="export-title" className="text-sm font-semibold text-foreground">
                Exportar JSON
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Contatos, modelos e agendamentos SQLite. Rotinas YAML ficam no arquivo de origem.
            </p>

            <label className="flex items-center gap-2 cursor-pointer pt-1 min-h-[44px]">
              <input
                type="checkbox"
                checked={includeRuns}
                onChange={(e) => setIncludeRuns(e.target.checked)}
                disabled={busy !== null}
                className="h-4 w-4 rounded border-border text-sky-500 focus:ring-sky-500"
              />
              <span className="text-xs text-foreground font-medium">
                Incluir histórico de execuções
              </span>
            </label>
          </div>

          <button
            type="button"
            id="btn-export-json"
            onClick={handleDownloadJson}
            disabled={busy !== null}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors min-h-[44px] active:scale-[0.98] disabled:opacity-50"
          >
            {busy === 'json' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            <span>{busy === 'json' ? 'Exportando…' : 'Exportar arquivo JSON (Exportar JSON)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
