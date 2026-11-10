/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackupExportCard } from './cmp-backup-export';
import { BackupImportCard } from './cmp-backup-import';
import { IntegrityCheckCard } from './cmp-integrity-check';

export function DataPage() {
  return (
    <div id="scr-data" className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Dados
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Guarde uma cópia, transfira registros ou verifique a integridade da agenda.
          </p>
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
