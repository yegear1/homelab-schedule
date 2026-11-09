/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Play,
  Pause,
  Clock,
  Calendar,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Tag,
  Repeat,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Job } from '../../types/domain';
import { StatusBadge, SourceBadge } from '../../components/wdg-status-badge';
import { useJobsStore } from '../../stores/jobs';

export interface JobInspectorProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobInspector({ job, open, onOpenChange }: JobInspectorProps) {
  const { runJobNow, togglePauseResume, snoozeJob, rescheduleJob, cancelJob } = useJobsStore();
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'projection'>('details');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newRunAt, setNewRunAt] = useState('');
  const [newCron, setNewCron] = useState('');

  if (!job) return null;
  const isYaml = job.source === 'yaml';

  const handleRunNow = async () => {
    toast.loading(`Triggering immediate run for ${job.title}...`, { id: `inspect-run-${job.id}` });
    const success = await runJobNow(job.id);
    if (success) {
      toast.success(`Dispatched ${job.title}`, {
        id: `inspect-run-${job.id}`,
        description: `HTTP 202 Accepted.`,
      });
    }
  };

  const handleTogglePause = () => {
    togglePauseResume(job.id);
    toast.info(job.status === 'paused' ? 'Schedule resumed' : 'Schedule paused');
  };

  const handleSnooze = (preset: string) => {
    snoozeJob(job.id, preset);
    toast.success(`Job snoozed until: ${preset}`);
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    rescheduleJob(job.id, {
      run_at: job.kind === 'once' ? newRunAt : undefined,
      cron_expr: job.kind === 'cron' ? newCron : undefined,
    });
    setIsRescheduling(false);
    toast.success('Job schedule modified successfully');
  };

  const handleCancel = () => {
    if (confirm(`Are you sure you want to cancel and delete "${job.title}"?`)) {
      cancelJob(job.id);
      toast.info('Job cancelled and removed from SQLite agenda');
      onOpenChange(false);
    }
  };

  // Mock next 5 projections
  const projections = [
    job.next_run_at || 'Tomorrow 08:00',
    'Nov 10, 2026 08:00',
    'Nov 11, 2026 08:00',
    'Nov 12, 2026 08:00',
    'Nov 13, 2026 08:00',
  ];

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
                  <StatusBadge status={job.status} size="sm" />
                  <SourceBadge source={job.source} size="sm" />
                </div>
                <Dialog.Title className="text-base font-semibold leading-tight">
                  {job.title}
                </Dialog.Title>
                <div className="text-xs font-mono text-muted-foreground">
                  ID: {job.id} {job.group_id && `· Group: ${job.group_id}`}
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
            {job.last_error && (
              <div className="mt-4 p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <div>
                  <span className="font-semibold block font-mono">Last Dispatch Failed</span>
                  <span className="font-mono text-[11px]">{job.last_error}</span>
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
                    {job.text || (job.template_id ? `[Template: ${job.template_id}]` : 'No payload defined')}
                  </div>
                </div>

                {/* Variable table */}
                {job.variables && Object.keys(job.variables).length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Template Variables
                    </span>
                    <div className="border border-border rounded-lg overflow-hidden font-mono text-[11px]">
                      {Object.entries(job.variables).map(([k, v]) => (
                        <div key={k} className="flex justify-between px-3 py-1.5 border-b border-border last:border-b-0 bg-background">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="text-foreground">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lifecycle counters */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg border border-border font-mono">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Executed</span>
                    <span className="text-sm font-bold tabular-nums">{job.runs_executed}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Retries</span>
                    <span className="text-sm font-bold tabular-nums">{job.retry_count} / {job.max_retries ?? 3}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Max Runs</span>
                    <span className="text-sm font-bold tabular-nums">{job.max_runs ?? '∞'}</span>
                  </div>
                </div>

                {/* Metadata details */}
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Recipient</span>
                    <span className="font-mono text-foreground">{job.recipient} ({job.recipient_alias || 'Alias'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created by</span>
                    <span className="font-mono text-foreground">{job.created_by || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Schedule</span>
                    <span className="font-mono text-foreground">{job.kind === 'cron' ? job.cron_expr : 'One-off'}</span>
                  </div>
                  {job.snooze_until && (
                    <div className="flex justify-between text-purple-400">
                      <span>Snooze until</span>
                      <span className="font-mono">{job.snooze_until}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="mt-4 space-y-2">
                {(job.recent_runs || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center font-mono">
                    No recorded execution history for this task.
                  </p>
                ) : (
                  job.recent_runs?.map((run) => (
                    <div key={run.id} className="p-3 rounded-lg border border-border bg-background text-xs space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className={run.status === 'success' ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                          HTTP {run.status_code} {run.status === 'success' ? 'Accepted' : 'Failed'}
                        </span>
                        <span className="text-muted-foreground text-[11px]">{run.duration_ms}ms</span>
                      </div>
                      <div className="text-muted-foreground font-mono text-[11px]">{run.timestamp}</div>
                      {run.error_message && (
                        <div className="text-rose-400 font-mono text-[10px] pt-1">{run.error_message}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'projection' && (
              <div className="mt-4 space-y-2 text-xs">
                <span className="text-[11px] text-muted-foreground block mb-2">
                  Next 5 Planned Trigger Dispatches (UTC)
                </span>
                {projections.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background font-mono text-[11px]">
                    <span className="text-muted-foreground">Run #{job.runs_executed + idx + 1}</span>
                    <span className="text-sky-500 font-medium">{p}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Action Bar */}
          <div className="pt-4 border-t border-border mt-6 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRunNow}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors min-h-[44px] active:scale-[0.98]"
              >
                <Play size={13} className="fill-current" />
                <span>Run Now</span>
              </button>
              <button
                type="button"
                disabled={isYaml}
                onClick={handleTogglePause}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border transition-colors min-h-[44px] active:scale-[0.98] ${
                  isYaml ? 'opacity-40 cursor-not-allowed' : 'bg-muted hover:bg-accent text-foreground'
                }`}
              >
                <Pause size={13} />
                <span>{job.status === 'paused' ? 'Resume' : 'Pause'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Snooze Presets */}
              <button
                type="button"
                disabled={isYaml}
                onClick={() => handleSnooze('+1 Hour')}
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
                disabled={isYaml}
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
