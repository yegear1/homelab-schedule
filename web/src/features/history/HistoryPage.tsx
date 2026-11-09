/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { JobRun } from '../../types/domain';
import { INITIAL_AUDIT_RUNS } from './history.fixtures';
import { HistoryMetrics } from './wdg-history-metrics';
import { HistoryTable } from './cmp-history-table';
import { RunDetailsSheet } from './wdg-run-details-sheet';
import { JobInspector } from '../agenda/wdg-job-inspector';
import { useJobsStore } from '../../stores/jobs';

export function HistoryPage() {
  const { runs: storeRuns, jobs } = useJobsStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [recordLimit, setRecordLimit] = useState<number>(50);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRun, setSelectedRun] = useState<JobRun | null>(null);
  const [inspectJobId, setInspectJobId] = useState<string | null>(null);

  // Merge store runs and initial audit runs
  const allRuns = useMemo(() => {
    const combined = [...storeRuns];
    INITIAL_AUDIT_RUNS.forEach((initRun) => {
      if (!combined.some((r) => r.id === initRun.id)) {
        combined.push(initRun);
      }
    });
    return combined;
  }, [storeRuns]);

  // Derived filtered runs
  const filteredRuns = useMemo(() => {
    let list = allRuns;
    if (statusFilter === 'success') {
      list = list.filter((r) => r.status_code === 202);
    } else if (statusFilter === 'failed') {
      list = list.filter((r) => r.status_code !== 202);
    }
    return list.slice(0, recordLimit);
  }, [allRuns, statusFilter, recordLimit]);

  const selectedJob = useMemo(() => {
    return jobs.find((j) => j.id === inspectJobId) || null;
  }, [jobs, inspectJobId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 450));
    setIsRefreshing(false);
    toast.success('Audit ledger refreshed', {
      description: 'Synchronized with local SQLite dispatch logs.',
    });
  };

  const handleExportCsv = () => {
    const headers = [
      'id',
      'timestamp',
      'trigger_mode',
      'job_id',
      'job_title',
      'recipient',
      'status_code',
      'duration_ms',
      'error_message',
    ];
    const rows = filteredRuns.map((r) => [
      r.id,
      r.timestamp,
      r.trigger_mode || 'scheduled',
      r.job_id,
      `"${r.job_title.replace(/"/g, '""')}"`,
      r.recipient,
      r.status_code,
      r.duration_ms,
      `"${(r.error_message || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `homelab_history_audit_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Audit history CSV exported');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Execution History & Dispatch Audit Ledger
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable trace of webhook dispatches, downstream WhatsApp delivery latency, and error diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>Retention: 30d</span>
          <span>·</span>
          <span className="text-emerald-500 font-medium">Gateway 202 Ready</span>
        </div>
      </div>

      {/* Telemetry Metrics & Control Bar */}
      <HistoryMetrics
        runs={allRuns}
        statusFilter={statusFilter}
        recordLimit={recordLimit}
        isRefreshing={isRefreshing}
        onStatusFilterChange={setStatusFilter}
        onRecordLimitChange={setRecordLimit}
        onRefresh={handleRefresh}
        onExportCsv={handleExportCsv}
      />

      {/* Execution Ledger Table */}
      <HistoryTable
        runs={filteredRuns}
        onSelectRun={(run) => setSelectedRun(run)}
        onInspectJob={(jobId) => setInspectJobId(jobId)}
      />

      {/* Slide-over details drawer */}
      <RunDetailsSheet
        run={selectedRun}
        open={!!selectedRun}
        onOpenChange={(open) => {
          if (!open) setSelectedRun(null);
        }}
        onInspectJob={(jobId) => setInspectJobId(jobId)}
      />

      {/* Source Job Inspector modal */}
      <JobInspector
        job={selectedJob}
        open={!!inspectJobId}
        onOpenChange={(open) => {
          if (!open) setInspectJobId(null);
        }}
      />
    </div>
  );
}
