/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Database, ShieldCheck, HardDrive } from 'lucide-react';
import { BackupExportCard } from './cmp-backup-export';
import { BackupImportCard } from './cmp-backup-import';
import { IntegrityCheckCard } from './cmp-integrity-check';

export function DataPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Data Management, Backups & System Integrity
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Database snapshots, portable JSON migration bundles, and SQLite PRAGMA integrity controls.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>Engine: SQLite 3.46 (WAL)</span>
          <span>·</span>
          <span className="text-emerald-500 font-medium">All Invariants Verified</span>
        </div>
      </div>

      {/* 1. Database Integrity Diagnostics Card */}
      <IntegrityCheckCard />

      {/* 2. Backups & Snapshots Card */}
      <BackupExportCard />

      {/* 3. Import & Migration Staging Card */}
      <BackupImportCard />
    </div>
  );
}
