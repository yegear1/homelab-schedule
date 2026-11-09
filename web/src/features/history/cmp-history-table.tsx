/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Clock, Play, CheckCircle2, AlertTriangle, AlertCircle, Eye, ExternalLink } from 'lucide-react';
import { JobRun } from '../../types/domain';

export interface HistoryTableProps {
  runs: JobRun[];
  onSelectRun: (run: JobRun) => void;
  onInspectJob: (jobId: string) => void;
}

export function HistoryTable({
  runs,
  onSelectRun,
  onInspectJob,
}: HistoryTableProps) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        <Clock className="mx-auto h-8 w-8 mb-2 opacity-50 text-sky-500" />
        <p className="text-sm font-medium text-foreground">No execution records found.</p>
        <p className="text-xs mt-1">Try resetting the status filter or triggering a manual test run.</p>
      </div>
    );
  }

  const renderStatusBadge = (code: number) => {
    if (code === 202) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={12} className="shrink-0" />
          <span>202 Accepted</span>
        </span>
      );
    }
    if (code === 502 || code === 500) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertTriangle size={12} className="shrink-0" />
          <span>{code} Bad Gateway</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <AlertCircle size={12} className="shrink-0" />
        <span>{code} Validation Error</span>
      </span>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <th className="py-3 px-4">Timestamp (UTC / Rel)</th>
            <th className="py-3 px-4">Trigger</th>
            <th className="py-3 px-4">Job Reference</th>
            <th className="py-3 px-4">Recipient</th>
            <th className="py-3 px-4">Gateway Status</th>
            <th className="py-3 px-4">Duration</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((run) => (
            <tr
              key={run.id}
              onClick={() => onSelectRun(run)}
              className="hover:bg-muted/40 transition-colors cursor-pointer group text-xs"
            >
              {/* Timestamp */}
              <td className="py-3 px-4 font-mono whitespace-nowrap">
                <div className="text-foreground tabular-nums font-medium">{run.timestamp}</div>
                <div className="text-[11px] text-muted-foreground">
                  {run.relative_time || 'Just now'}
                </div>
              </td>

              {/* Trigger Mode */}
              <td className="py-3 px-4">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono capitalize ${
                    run.trigger_mode === 'manual'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {run.trigger_mode === 'manual' ? (
                    <Play size={10} className="fill-current" />
                  ) : (
                    <Clock size={10} />
                  )}
                  <span>{run.trigger_mode || 'scheduled'}</span>
                </span>
              </td>

              {/* Job Reference */}
              <td className="py-3 px-4 max-w-xs">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspectJob(run.job_id);
                  }}
                  className="font-medium text-foreground hover:text-sky-500 truncate flex items-center gap-1 group-hover:underline"
                  title="Click to inspect source job"
                >
                  <span className="truncate">{run.job_title}</span>
                  <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  ID: {run.job_id}
                </div>
              </td>

              {/* Recipient */}
              <td className="py-3 px-4 font-mono text-foreground whitespace-nowrap tabular-nums">
                {run.recipient}
              </td>

              {/* Gateway Status Code */}
              <td className="py-3 px-4 whitespace-nowrap">
                {renderStatusBadge(run.status_code)}
              </td>

              {/* Duration */}
              <td className="py-3 px-4 font-mono tabular-nums text-foreground">
                <span className={run.duration_ms > 1000 ? 'text-amber-500 font-bold' : ''}>
                  {run.duration_ms}ms
                </span>
              </td>

              {/* Actions */}
              <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onSelectRun(run)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors min-h-[36px] active:scale-[0.98]"
                >
                  <Eye size={12} />
                  <span>View Details</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
