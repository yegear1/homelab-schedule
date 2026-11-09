/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Clock, Play, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Job } from '../../types/domain';
import { StatusBadge } from '../../components/wdg-status-badge';
import { useJobsStore } from '../../stores/jobs';
import { QUEUED_NOT_DELIVERED, runWithFeedback } from '../../lib/jobs/mutations';

export interface JobsTimelineProps {
  jobs: Job[];
  onInspect: (jobId: string) => void;
}

export function JobsTimeline({ jobs, onInspect }: JobsTimelineProps) {
  const { runs, runJobNow } = useJobsStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');

  const upcomingEvents = useMemo(() => {
    return jobs
      .filter((j) => j.status === 'scheduled' || j.status === 'snoozed')
      .map((job) => ({
        id: job.id,
        title: job.title,
        time: job.next_run_at || job.run_at || 'Scheduled',
        recipient: job.recipient,
        kind: job.kind,
        cron_expr: job.cron_expr,
        status: job.status,
        tags: job.tags,
      }));
  }, [jobs]);

  const pastEvents = useMemo(() => {
    return runs.slice(0, 15);
  }, [runs]);

  const handleRunNow = async (e: React.MouseEvent, jobId: string, title: string) => {
    e.stopPropagation();
    await runWithFeedback({
      id: `timeline-run-${jobId}`,
      pending: `Dispatching ${title}...`,
      success: `Queued ${title}`,
      description: QUEUED_NOT_DELIVERED,
      failure: `Dispatch failed for ${title}`,
      action: () => runJobNow(jobId),
    });
  };

  return (
    <div id="job-timeline-view" className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-xs">
      {/* Timeline view tab header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border mb-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-sky-500" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Chronological Dispatch Timeline</h2>
            <span className="text-[11px] text-muted-foreground">até 100 tentativas retidas</span>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg border border-border">
          <button
            type="button"
            id="timeline-filter-all"
            onClick={() => setActiveTab('upcoming')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[36px] ${
              activeTab === 'upcoming'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            type="button"
            id="timeline-filter-future"
            onClick={() => setActiveTab('upcoming')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[36px] ${
              activeTab === 'upcoming'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Upcoming Plan ({upcomingEvents.length})
          </button>
          <button
            type="button"
            id="timeline-filter-history"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[36px] ${
              activeTab === 'history'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Recent Dispatches ({pastEvents.length})
          </button>
          <button
            type="button"
            id="btn-timeline-refresh-runs"
            onClick={() => toast.info('Refreshed runs')}
            className="p-1.5 text-muted-foreground hover:text-foreground"
            title="Refresh runs"
          >
            <Clock size={13} />
          </button>
        </div>
      </div>

      {activeTab === 'upcoming' ? (
        <div id="timeline-future-section" className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {upcomingEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => onInspect(event.id)}
              className="relative group p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <div className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-background bg-sky-500 group-hover:scale-125 transition-transform" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{event.title}</span>
                    <StatusBadge status={event.status} size="sm" />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                    <span className="text-sky-500 font-medium">{event.time}</span>
                    <span>·</span>
                    <span>{event.recipient}</span>
                    {event.cron_expr && (
                      <>
                        <span>·</span>
                        <span className="text-foreground">{event.cron_expr}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => handleRunNow(e, event.id, event.title)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 border border-sky-500/20 transition-colors min-h-[36px] active:scale-[0.98]"
                  >
                    <Play size={12} className="fill-current" />
                    <span>Run Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onInspect(event.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div id="timeline-history-section" className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {pastEvents.map((run) => (
            <div
              key={run.id}
              className="relative p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors"
            >
              <div
                className={`absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-background ${
                  run.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{run.job_title}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                        run.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}
                    >
                      HTTP {run.status_code}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono tabular-nums">
                    <span>{run.timestamp}</span>
                    <span>·</span>
                    <span>{run.recipient}</span>
                    <span>·</span>
                    <span>{run.duration_ms.toFixed(1)}ms</span>
                  </div>
                  {run.error_message && (
                    <p className="mt-2 text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-md">
                      {run.error_message}
                    </p>
                  )}
                </div>
                {run.status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 self-start sm:self-auto" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 self-start sm:self-auto" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
