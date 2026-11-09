/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Database, FileDown, CheckCircle2, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useJobsStore } from '../../stores/jobs';

export function BackupExportCard() {
  const { jobs, runs, templates, contacts } = useJobsStore();
  const [includeRuns, setIncludeRuns] = useState(true);
  const [isExportingSqlite, setIsExportingSqlite] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  // 1. Raw SQLite Database Snapshot binary download (GET /backup/database)
  const handleDownloadSqlite = async () => {
    setIsExportingSqlite(true);
    toast.loading('Checkpointing WAL & generating consistent snapshot...', { id: 'sqlite-snap' });
    await new Promise((r) => setTimeout(r, 600));

    // Simulated SQLite 3 binary header
    const sqliteHeader = 'SQLite format 3\0\x10\x00\x01\x01\x00@  ';
    const blob = new Blob([sqliteHeader + 'HOMELAB_SCHEDULE_DB_SNAPSHOT_PAYLOAD'], {
      type: 'application/x-sqlite3',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenda_snapshot_${new Date().toISOString().split('T')[0]}.sqlite3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsExportingSqlite(false);
    toast.success('Raw SQLite database snapshot downloaded', {
      id: 'sqlite-snap',
      description: 'Point-in-time binary snapshot saved with WAL flushed.',
    });
  };

  // 2. Standard JSON Data Bundle (GET /backup/export)
  const handleDownloadJson = async () => {
    setIsExportingJson(true);
    await new Promise((r) => setTimeout(r, 400));

    // Exclude YAML source routines (managed externally via routines.yaml)
    const sqliteJobsOnly = jobs.filter((j) => j.source !== 'yaml');

    const bundle = {
      schema_version: '1.4.0',
      exported_at: new Date().toISOString(),
      environment: 'homelab-production',
      generator: 'homelab-schedule/v2.1',
      stats: {
        contacts_count: contacts.length,
        templates_count: templates.length,
        jobs_count: sqliteJobsOnly.length,
        runs_count: includeRuns ? runs.length : 0,
      },
      contacts,
      templates,
      jobs: sqliteJobsOnly,
      job_runs: includeRuns ? runs : [],
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homelab_schedule_bundle_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsExportingJson(false);
    toast.success('JSON data bundle downloaded', {
      description: `Exported ${sqliteJobsOnly.length} jobs, ${contacts.length} contacts, and ${templates.length} templates.`,
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-sky-500" />
          <h2 className="text-base font-semibold text-foreground">
            Database Backups & Export
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={12} />
          <span>Consistent WAL Snapshot Ready</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Raw SQLite Snapshot */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Raw SQLite Binary Snapshot
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Downloads a direct binary clone of the active <span className="font-mono text-foreground">agenda.sqlite3</span> database with a passive WAL checkpoint. Compatible with standard SQLite 3 cli and litestream.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground pt-1">
              <span>Endpoint: GET /backup/database</span>
              <span>·</span>
              <span className="text-emerald-500 font-medium">Safe concurrent read</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadSqlite}
            disabled={isExportingSqlite}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] shadow-xs"
          >
            {isExportingSqlite ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            <span>Download .sqlite3 Snapshot</span>
          </button>
        </div>

        {/* 2. Standard JSON Data Bundle */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileDown className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Portable JSON Data Bundle
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Human-readable JSON export containing all SQLite-managed contacts, templates, and jobs. Note: YAML-defined routines are excluded to preserve declarative parity.
            </p>

            {/* Toggle include runs */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={includeRuns}
                onChange={(e) => setIncludeRuns(e.target.checked)}
                className="h-4 w-4 rounded border-border text-sky-500 focus:ring-sky-500"
              />
              <span className="text-xs text-foreground font-medium">
                Include execution audit runs ({runs.length} records)
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleDownloadJson}
            disabled={isExportingJson}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors min-h-[44px] active:scale-[0.98]"
          >
            {isExportingJson ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            <span>Download JSON Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}
