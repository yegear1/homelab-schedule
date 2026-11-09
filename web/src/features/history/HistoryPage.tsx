/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { JobRun } from '../../types/domain';
import { JobRun as ApiJobRun } from '../../lib/types';
import { api } from '../../lib/api';
import { INITIAL_AUDIT_RUNS } from './history.fixtures';
import { HistoryMetrics } from './wdg-history-metrics';
import { HistoryTable } from './cmp-history-table';
import { RunDetailsSheet } from './wdg-run-details-sheet';
import { JobInspector } from '../agenda/wdg-job-inspector';
import { useJobsStore } from '../../stores/jobs';

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (isNaN(diffMs)) return dateStr;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } catch {
    return dateStr;
  }
}

export function HistoryPage() {
  const { runs: storeRuns, jobs, fetchJobs } = useJobsStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [recordLimit, setRecordLimit] = useState<number>(50);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRun, setSelectedRun] = useState<JobRun | null>(null);
  const [inspectJobId, setInspectJobId] = useState<string | null>(null);
  const [apiRuns, setApiRuns] = useState<JobRun[] | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const statusParam = statusFilter === 'all' ? undefined : (statusFilter === 'success' ? 'success' : 'error');
      const runsData = await api.getAllJobRuns(recordLimit, statusParam);
      const mapped: JobRun[] = runsData.map((r: ApiJobRun) => {
        const job = jobs.find((j) => j.id === r.job_id);
        const isSuccess = r.status === 'success' || r.status_code === 202;
        return {
          id: r.id,
          job_id: r.job_id,
          job_title: job?.title || `Job ${r.job_id}`,
          recipient: job?.recipient || job?.recipient_alias || 'Webhook target',
          timestamp: r.ran_at,
          relative_time: formatRelativeTime(r.ran_at),
          trigger_mode: r.trigger === 'manual' ? 'manual' : 'scheduled',
          status_code: r.status_code,
          status: isSuccess ? 'success' : 'failed',
          duration_ms: Math.round(r.duration_ms),
          payload_preview: job?.text || `Dispatch to ${job?.recipient || 'target'}`,
          rendered_payload: job?.text,
          error_message: r.error_message || undefined,
        };
      });
      setApiRuns(mapped);
    } catch {
      // Fallback to local store or fixtures if offline
      setApiRuns(null);
    }
  }, [statusFilter, recordLimit, jobs]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Merge store runs and initial audit runs if apiRuns is null
  const allRuns = useMemo(() => {
    if (apiRuns !== null) {
      return apiRuns;
    }
    const combined = [...storeRuns];
    INITIAL_AUDIT_RUNS.forEach((initRun) => {
      if (!combined.some((r) => r.id === initRun.id)) {
        combined.push(initRun);
      }
    });
    return combined;
  }, [apiRuns, storeRuns]);

  // Derived filtered runs
  const filteredRuns = useMemo(() => {
    if (apiRuns !== null) {
      return apiRuns;
    }
    let list = allRuns;
    if (statusFilter === 'success') {
      list = list.filter((r) => r.status_code === 202);
    } else if (statusFilter === 'failed') {
      list = list.filter((r) => r.status_code !== 202);
    }
    return list.slice(0, recordLimit);
  }, [apiRuns, allRuns, statusFilter, recordLimit]);

  const selectedJob = useMemo(() => {
    return jobs.find((j) => j.id === inspectJobId) || null;
  }, [jobs, inspectJobId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchJobs(), loadRuns()]);
      toast.success('Audit ledger refreshed', {
        description: 'Synchronized with local SQLite dispatch logs.',
      });
    } catch {
      toast.error('Failed to refresh audit ledger');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter === 'success' ? 'success' : 'error');
      }
      const blob = await api.downloadCsv('/jobs/runs/export.csv', params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `homelab_history_audit_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Audit history CSV exported');
    } catch (error: unknown) {
      toast.error(`Falha ao exportar CSV: ${error instanceof Error ? error.message : 'falha de conexão'}`);
    }
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
