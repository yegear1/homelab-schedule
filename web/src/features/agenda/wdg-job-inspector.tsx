/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Play,
  Pause,
  Clock,
  Calendar,
  Trash2,
  AlertTriangle,
  RotateCw,
  Repeat,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Job, JobRun } from '../../types/domain';
import { UpcomingRunItem } from '../../lib/types';
import { StatusBadge, SourceBadge } from '../../components/wdg-status-badge';
import { useJobsStore } from '../../stores/jobs';
import { api } from '../../lib/api';
import { QUEUED_NOT_DELIVERED, runWithFeedback, type MutationFeedback } from '../../lib/jobs/mutations';

export interface JobInspectorProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobInspector({ job, open, onOpenChange }: JobInspectorProps) {
  const { runJobNow, togglePauseResume, snoozeJob, rescheduleJob, cancelJob, retryJob } = useJobsStore();
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'projection'>('details');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newRunAt, setNewRunAt] = useState('');
  const [newCron, setNewCron] = useState('');
  const [fullJob, setFullJob] = useState<Job | null>(null);
  const [auditRuns, setAuditRuns] = useState<JobRun[]>([]);
  const [upcomingRuns, setUpcomingRuns] = useState<UpcomingRunItem[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!job || !open) {
      setFullJob(null);
      setAuditRuns([]);
      setUpcomingRuns([]);
      return;
    }
    let active = true;

    api.getJob(job.id)
      .then((loaded) => {
        if (!active) return;
        setFullJob({
          ...job,
          text: loaded.content,
          template_id: loaded.template_id || undefined,
          variables: loaded.variables || {},
          tags: loaded.tags || [],
        });
      })
      .catch(() => {
        if (active) setFullJob(job);
      });

    return () => {
      active = false;
    };
  }, [job?.id, open]);

  useEffect(() => {
    if (!job || !open) return;
    let active = true;

    if (activeTab === 'history') {
      setLoadingRuns(true);
      api.getJobRuns(job.id, 50)
        .then((rawRuns) => {
          if (!active) return;
          const mapped: JobRun[] = rawRuns.map((r) => ({
            id: r.id,
            job_id: r.job_id,
            job_title: job.title,
            recipient: job.recipient,
            timestamp: r.ran_at ? r.ran_at.replace('T', ' ').substring(0, 19) : '',
            status_code: r.status_code,
            status: r.status === 'success' ? 'success' : 'failed',
            duration_ms: Math.round(r.duration_ms),
            payload_preview: '',
            error_message: r.error_message || undefined,
          }));
          setAuditRuns(mapped);
        })
        .catch(() => {
          if (active) setAuditRuns(job.recent_runs || []);
        })
        .finally(() => {
          if (active) setLoadingRuns(false);
        });
    } else if (activeTab === 'projection') {
      setLoadingUpcoming(true);
      api.getUpcomingRuns(job.id, 5)
        .then((res) => {
          if (!active) return;
          setUpcomingRuns(res.runs || []);
        })
        .catch(() => {
          // Keep empty if none
        })
        .finally(() => {
          if (!active) setLoadingUpcoming(false);
        });
    }

    return () => {
      active = false;
    };
  }, [job?.id, activeTab, open]);

  if (!job) return null;
  const currentJob = fullJob || job;
  const isYaml = currentJob.source === 'yaml';

  const rejectYaml = (): boolean => {
    if (!isYaml) return false;
    toast.error('Rotinas YAML são imutáveis (edite routines.yaml)');
    return true;
  };

  const mutate = async (feedback: MutationFeedback): Promise<boolean> => {
    setIsBusy(true);
    try {
      return await runWithFeedback(feedback);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunNow = () =>
    mutate({
      id: `inspect-run-${currentJob.id}`,
      pending: `Triggering immediate run for ${currentJob.title}...`,
      success: `Queued ${currentJob.title}`,
      description: QUEUED_NOT_DELIVERED,
      failure: 'Dispatch failed',
      action: () => runJobNow(currentJob.id),
    });

  const handleTogglePause = async () => {
    if (rejectYaml()) return;
    await mutate({
      id: `inspect-pause-${currentJob.id}`,
      success: currentJob.status === 'paused' ? 'Schedule resumed' : 'Schedule paused',
      failure: 'Operation failed',
      action: () => togglePauseResume(currentJob.id),
    });
  };

  const handleSnooze = async (preset: string) => {
    if (rejectYaml()) return;
    await mutate({
      id: `inspect-snooze-${currentJob.id}`,
      success: `Job snoozed: ${preset}`,
      failure: 'Snooze failed',
      action: () => snoozeJob(currentJob.id, preset),
    });
  };

  const handleRetry = async () => {
    if (rejectYaml()) return;
    await mutate({
      id: `inspect-retry-${currentJob.id}`,
      success: `Job queued for another attempt: ${currentJob.title}`,
      description: QUEUED_NOT_DELIVERED,
      failure: 'Retry failed',
      action: () => retryJob(currentJob.id),
    });
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectYaml()) return;
    const accepted = await mutate({
      id: `inspect-reschedule-${currentJob.id}`,
      success: 'Job schedule modified',
      failure: 'Reschedule failed',
      action: () => rescheduleJob(currentJob.id, {
        run_at: currentJob.kind === 'once' ? (newRunAt ? new Date(newRunAt).toISOString() : undefined) : undefined,
        cron_expr: currentJob.kind === 'cron' ? newCron : undefined,
      }),
    });
    if (accepted) setIsRescheduling(false);
  };

  const handleCancel = async () => {
    if (rejectYaml()) return;
    if (!confirm(`Are you sure you want to cancel and delete "${currentJob.title}"?`)) return;
    const accepted = await mutate({
      id: `inspect-cancel-${currentJob.id}`,
      success: 'Job cancelled',
      failure: 'Cancellation failed',
      action: () => cancelJob(currentJob.id),
    });
    if (accepted) onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md border-l border-border bg-card p-6 shadow-2xl overflow-y-auto text-foreground focus:outline-none flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={currentJob.status} size="sm" />
                  <SourceBadge source={currentJob.source} size="sm" />
                </div>
                <Dialog.Title className="text-base font-semibold leading-tight">
                  {currentJob.title}
                </Dialog.Title>
                <div className="text-xs font-mono text-muted-foreground">
                  ID: {currentJob.id} {currentJob.group_id && `· Group: ${currentJob.group_id}`}
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>

            {/* Error banner if last execution failed */}
            {currentJob.last_error && (
              <div id="detail-dead-letter-box" className="mt-4 p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <div>
                  <span className="font-semibold block font-mono">Last Dispatch Failed</span>
                  <span id="detail-dead-letter-error" className="font-mono text-[11px]">{currentJob.last_error}</span>
                  <span id="detail-dead-letter-retries" className="block text-[10px] mt-0.5 opacity-80">
                    Tentativas: {currentJob.retry_count ?? '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-border mt-4">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-sky-500 text-sky-500 font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Payload & Specs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-sky-500 text-sky-500 font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Audit Runs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('projection')}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'projection'
                    ? 'border-sky-500 text-sky-500 font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Upcoming
              </button>
            </div>

            {/* Content per Tab */}
            {activeTab === 'details' && (
              <div className="mt-4 space-y-4 text-xs">
                {/* Rendered Payload */}
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Rendered Notification Payload
                  </span>
                  <div className="p-3 rounded-lg border border-border bg-background font-mono text-xs whitespace-pre-wrap text-foreground">
                    {currentJob.text || (currentJob.template_id ? `[Template: ${currentJob.template_id}]` : 'No payload defined')}
                  </div>
                </div>

                {/* Variable table */}
                {currentJob.variables && Object.keys(currentJob.variables).length > 0 && (
                  <div id="detail-variables-card">
                    <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Template Variables
                    </span>
                    <div className="border border-border rounded-lg overflow-hidden font-mono text-[11px]">
                      {Object.entries(currentJob.variables).map(([k, v]) => (
                        <div key={k} className="flex justify-between px-3 py-1.5 border-b border-border last:border-b-0 bg-background">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="text-foreground">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lifecycle counters */}
                <div id="detail-runs" className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg border border-border font-mono">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Executed</span>
                    <span className="text-sm font-bold tabular-nums">{currentJob.runs_executed ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Retries</span>
                    <span className="text-sm font-bold tabular-nums">{currentJob.retry_count ?? '—'}{currentJob.max_retries !== undefined ? ` / ${currentJob.max_retries}` : ''}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Max Runs</span>
                    <span className="text-sm font-bold tabular-nums">{currentJob.max_runs ?? '∞'}</span>
                  </div>
                </div>

                {/* Tags Card */}
                <div id="detail-tags-card" className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground block mb-1">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {currentJob.tags?.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded text-xs bg-muted font-mono">#{t}</span>
                    ))}
                  </div>
                </div>

                {/* Metadata details */}
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Recipient</span>
                    <span className="font-mono text-foreground">{currentJob.recipient} ({currentJob.recipient_alias || 'Alias'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created by</span>
                    <span className="font-mono text-foreground">{currentJob.created_by || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Schedule</span>
                    <span className="font-mono text-foreground">{currentJob.kind === 'cron' ? currentJob.cron_expr : 'One-off'}</span>
                  </div>
                  <div id="detail-until" className="flex justify-between">
                    <span>Until</span>
                    <span className="font-mono text-foreground">{currentJob.until || 'Indefinite'}</span>
                  </div>
                  {currentJob.snooze_until && (
                    <div className="flex justify-between text-purple-400">
                      <span>Snooze until</span>
                      <span className="font-mono">{currentJob.snooze_until}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div id="detail-runs-section" className="mt-4 space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-semibold text-foreground">Histórico de Disparos</span>
                  <button
                    type="button"
                    id="btn-refresh-runs"
                    onClick={() => {
                      if (!job) return;
                      setLoadingRuns(true);
                      api.getJobRuns(job.id, 20)
                        .then((runs) => {
                          setAuditRuns(
                            runs.map((r) => ({
                              id: r.id,
                              job_id: r.job_id,
                              job_title: job.title,
                              recipient: job.recipient,
                              timestamp: r.ran_at ? r.ran_at.replace('T', ' ').substring(0, 19) : '',
                              status_code: r.status_code,
                              status: r.status === 'success' ? 'success' : 'failed',
                              duration_ms: Math.round(r.duration_ms),
                              payload_preview: '',
                              error_message: r.error_message || undefined,
                            }))
                          );
                        })
                        .finally(() => setLoadingRuns(false));
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Refresh runs"
                  >
                    <RotateCw size={12} className={loadingRuns ? 'animate-spin' : ''} />
                  </button>
                </div>
                {loadingRuns ? (
                  <div id="runs-loading" className="py-8 flex justify-center">
                    <Loader2 className="animate-spin h-5 w-5 text-sky-500" />
                  </div>
                ) : auditRuns.length === 0 ? (
                  <p id="runs-empty" className="text-xs text-muted-foreground py-6 text-center font-mono">
                    No recorded execution history for this task.
                  </p>
                ) : (
                  <div id="runs-list" className="space-y-2">
                    {auditRuns.map((run) => (
                      <div key={run.id} className="p-3 rounded-lg border border-border bg-background text-xs space-y-1">
                        <div className="flex items-center justify-between font-mono">
                          <span className={run.status === 'success' ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                            HTTP {run.status_code} {run.status === 'success' ? 'Accepted' : 'Failed'}
                          </span>
                          <span className="text-muted-foreground text-[11px]">{run.duration_ms.toFixed(1)}ms</span>
                        </div>
                        <div className="text-muted-foreground font-mono text-[11px]">{run.timestamp}</div>
                        {run.error_message && (
                          <div className="text-rose-400 font-mono text-[10px] pt-1">{run.error_message}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'projection' && (
              <div id="detail-upcoming-card" className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground">
                    Next Planned Trigger Dispatches (UTC)
                  </span>
                  <button
                    type="button"
                    id="btn-refresh-upcoming"
                    onClick={() => {
                      if (!job) return;
                      setLoadingUpcoming(true);
                      api.getUpcomingRuns(job.id, 5)
                        .then((res) => setUpcomingRuns(res.runs))
                        .finally(() => setLoadingUpcoming(false));
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Refresh upcoming"
                  >
                    <RotateCw size={12} className={loadingUpcoming ? 'animate-spin' : ''} />
                  </button>
                </div>
                {loadingUpcoming ? (
                  <div id="upcoming-loading" className="py-8 flex justify-center">
                    <Loader2 className="animate-spin h-5 w-5 text-sky-500" />
                  </div>
                ) : upcomingRuns.length === 0 ? (
                  <p id="upcoming-empty" className="text-xs text-muted-foreground py-6 text-center font-mono">
                    No upcoming runs projected for this task.
                  </p>
                ) : (
                  <div id="upcoming-list" className="space-y-1.5">
                    {upcomingRuns.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background font-mono text-[11px]">
                        <span className="text-muted-foreground">Próxima #{idx + 1}</span>
                        <span className="text-sky-500 font-medium">
                          {p.formatted_date || p.run_at_local || p.run_at} {p.time_local ? `(${p.time_local})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interactive Action Bar */}
          <div className="pt-4 border-t border-border mt-6 space-y-2">
            {/* Dead-Letter Retry Action if error */}
            {currentJob.status === 'error' && (
              <button
                type="button"
                id="btn-dead-letter-retry"
                disabled={isYaml || isBusy}
                onClick={handleRetry}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors min-h-[44px] active:scale-[0.98] btn-detail-retry ${
                  isYaml ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <RotateCw size={13} />
                <span>Retry Dead-Letter Job</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-dead-letter-run-now"
                disabled={isBusy}
                onClick={handleRunNow}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98] disabled:opacity-50"
              >
                <Play size={13} className="fill-current" />
                <span>Run Now</span>
              </button>
              <button
                type="button"
                id={currentJob.status === 'paused' ? 'btn-detail-resume' : 'btn-detail-pause'}
                disabled={isYaml || isBusy}
                onClick={handleTogglePause}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border transition-colors min-h-[44px] active:scale-[0.98] ${
                  isYaml ? 'opacity-40 cursor-not-allowed' : 'bg-muted hover:bg-accent text-foreground'
                }`}
              >
                <Pause size={13} />
                <span>{currentJob.status === 'paused' ? 'Resume' : 'Pause'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Snooze Presets */}
              <button
                type="button"
                id="btn-detail-snooze"
                disabled={isYaml || isBusy}
                onClick={() => handleSnooze('+1h')}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border transition-colors min-h-[44px] active:scale-[0.98] ${
                  isYaml ? 'opacity-40 cursor-not-allowed' : 'bg-muted hover:bg-accent text-foreground'
                }`}
              >
                <Clock size={13} />
                <span>Snooze +1h</span>
              </button>

              {/* Cancel Job */}
              <button
                type="button"
                disabled={isYaml || isBusy}
                onClick={handleCancel}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-colors min-h-[44px] active:scale-[0.98] ${
                  isYaml ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <Trash2 size={13} />
                <span>Cancel Job</span>
              </button>
            </div>

            {isYaml && (
              <p className="text-[11px] text-center font-mono text-muted-foreground pt-1">
                Managed via routines.yaml (immutable in SQLite)
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
