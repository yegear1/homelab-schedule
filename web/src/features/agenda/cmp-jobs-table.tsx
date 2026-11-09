/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Clock,
  Layers,
  Eye,
  Calendar,
  Repeat,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Job } from '../../types/domain';
import { StatusBadge, SourceBadge } from '../../components/wdg-status-badge';
import { useJobsStore } from '../../stores/jobs';

export interface JobsTableProps {
  jobs: Job[];
  onInspect: (jobId: string) => void;
}

export function JobsTable({ jobs, onInspect }: JobsTableProps) {
  const { runJobNow, togglePauseResume, snoozeJob } = useJobsStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Group batch jobs by group_id if present
  const { singleJobs, groupedBatches } = useMemo(() => {
    const singles: Job[] = [];
    const batches: Record<string, Job[]> = {};

    jobs.forEach((job) => {
      if (job.group_id) {
        if (!batches[job.group_id]) batches[job.group_id] = [];
        batches[job.group_id].push(job);
      } else {
        singles.push(job);
      }
    });

    return { singleJobs: singles, groupedBatches: batches };
  }, [jobs]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleRunNow = async (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    toast.loading(`Dispatching ${job.title}...`, { id: `run-${job.id}` });
    const success = await runJobNow(job.id);
    if (success) {
      toast.success(`Dispatched ${job.title}`, {
        id: `run-${job.id}`,
        description: `HTTP 202 Accepted → Sent to ${job.recipient}`,
      });
    }
  };

  const handleTogglePause = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    togglePauseResume(job.id);
    toast.info(
      job.status === 'paused'
        ? `Resumed schedule: ${job.title}`
        : `Paused schedule: ${job.title}`
    );
  };

  const handleQuickSnooze = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    snoozeJob(job.id, 'In 1 hour');
    toast.success(`Snoozed ${job.title} for 1 hour`);
  };

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50 text-sky-500" />
        <p className="text-sm font-medium text-foreground">No jobs match your filter criteria.</p>
        <p className="text-xs mt-1">Try adjusting the search query, tag filters, or status tab.</p>
      </div>
    );
  }

  const renderJobRow = (job: Job, isChild = false) => {
    const isYaml = job.source === 'yaml';
    return (
      <tr
        key={job.id}
        onClick={() => onInspect(job.id)}
        className={`group border-b border-border transition-colors hover:bg-muted/50 cursor-pointer ${
          isChild ? 'bg-muted/20' : 'bg-card'
        }`}
      >
        {/* Title, Source & Tags */}
        <td className="py-3 px-4 max-w-xs">
          <div className="flex items-center gap-2">
            {isChild && <span className="text-muted-foreground/40 font-mono text-xs">└─</span>}
            <span className="font-medium text-sm text-foreground truncate">{job.title}</span>
            <SourceBadge source={job.source} />
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
            {job.tags.map((t) => (
              <span key={t} className="font-mono">#{t}</span>
            ))}
            {job.last_error && (
              <>
                <span>·</span>
                <span className="text-rose-500 truncate font-mono max-w-[200px]" title={job.last_error}>
                  {job.last_error}
                </span>
              </>
            )}
          </div>
        </td>

        {/* Recipients */}
        <td className="py-3 px-4 text-xs font-mono tabular-nums">
          <div className="text-foreground">{job.recipient_alias || 'Recipient'}</div>
          <div className="text-muted-foreground text-[11px]">{job.recipient}</div>
        </td>

        {/* Schedule / Kind */}
        <td className="py-3 px-4 text-xs">
          {job.kind === 'cron' ? (
            <div className="flex flex-col">
              <span className="inline-flex items-center gap-1 font-mono font-medium text-sky-500 tabular-nums">
                <Repeat size={12} />
                {job.cron_expr}
              </span>
              <span className="text-[11px] text-muted-foreground">{job.cron_human || 'Recurring'}</span>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="inline-flex items-center gap-1 font-mono text-foreground tabular-nums">
                <Calendar size={12} className="text-muted-foreground" />
                Once
              </span>
              <span className="text-[11px] text-muted-foreground font-mono tabular-nums truncate max-w-[140px]">
                {job.run_at ? new Date(job.run_at).toLocaleString() : 'Immediate'}
              </span>
            </div>
          )}
        </td>

        {/* Status */}
        <td className="py-3 px-4">
          <StatusBadge status={job.status} />
        </td>

        {/* Quick Action Bar */}
        <td className="py-3 px-4 text-right">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => handleRunNow(e, job)}
              title="Run Now (POST /jobs/{id}/run)"
              className="p-2 rounded-lg text-sky-500 hover:bg-sky-500/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98]"
            >
              <Play size={14} className="fill-current" />
            </button>
            <button
              type="button"
              disabled={isYaml}
              onClick={(e) => handleTogglePause(e, job)}
              title={isYaml ? 'Managed via routines.yaml' : job.status === 'paused' ? 'Resume' : 'Pause'}
              className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98] ${
                isYaml
                  ? 'text-muted-foreground/30 cursor-not-allowed'
                  : 'text-amber-500 hover:bg-amber-500/10'
              }`}
            >
              <Pause size={14} />
            </button>
            <button
              type="button"
              disabled={isYaml}
              onClick={(e) => handleQuickSnooze(e, job)}
              title={isYaml ? 'Managed via routines.yaml' : 'Quick Snooze (+1h)'}
              className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98] ${
                isYaml
                  ? 'text-muted-foreground/30 cursor-not-allowed'
                  : 'text-purple-500 hover:bg-purple-500/10'
              }`}
            >
              <Clock size={14} />
            </button>
            <button
              type="button"
              onClick={() => onInspect(job.id)}
              title="Inspect Details"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98]"
            >
              <Eye size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <th className="py-3 px-4">Job Title & Tags</th>
            <th className="py-3 px-4">Recipients</th>
            <th className="py-3 px-4">Schedule / Kind</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {/* Render Batch Groups First */}
          {Object.entries(groupedBatches).map(([groupId, batchJobs]) => {
            const isExpanded = expandedGroups[groupId] ?? true;
            const primaryJob = batchJobs[0];
            return (
              <tbody key={groupId} className="contents">
                <tr
                  onClick={() => toggleGroup(groupId)}
                  className="bg-muted/30 hover:bg-muted/50 cursor-pointer border-b border-border"
                >
                  <td colSpan={5} className="py-2.5 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Layers size={14} className="text-sky-500" />
                        <span className="font-semibold text-xs text-foreground">
                          Batch Group: {groupId}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          ({batchJobs.length} recipients · {primaryJob.title})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        Click to {isExpanded ? 'collapse' : 'expand'}
                      </span>
                    </div>
                  </td>
                </tr>
                {isExpanded && batchJobs.map((j) => renderJobRow(j, true))}
              </tbody>
            );
          })}

          {/* Render Standalone Single Jobs */}
          {singleJobs.map((j) => renderJobRow(j, false))}
        </tbody>
      </table>
    </div>
  );
}
