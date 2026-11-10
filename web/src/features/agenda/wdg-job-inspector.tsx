/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
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
import { Job } from '../../types/domain';
import { ApiClientError } from '../../lib/api';
import { mapJobListItemToDomain } from '../../stores/jobs';
import { useInspectorResource } from './use-inspector-resource';
import { StatusBadge, SourceBadge } from '../../components/wdg-status-badge';
import { useJobsStore } from '../../stores/jobs';
import { api } from '../../lib/api';
import { QUEUED_NOT_DELIVERED, runWithFeedback, type MutationFeedback } from '../../lib/jobs/mutations';

export interface JobInspectorProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string | null;
}

export function JobInspector({ job, jobId, open, onOpenChange }: JobInspectorProps) {
  const id = jobId || job?.id || '';
  if (!open || !id) return null;
  return <InspectorLoader key={id} id={id} onOpenChange={onOpenChange} />;
}

function InspectorLoader({ id, onOpenChange }: { id: string; onOpenChange: (open: boolean) => void }) {
  const open = true;
  const contacts = useJobsStore((state) => state.contacts);
  const [revision, setRevision] = useState(0);
  const load = useCallback(() => api.getJob(id), [id]);
  const detail = useInspectorResource(id, load, revision);
  if (detail.status !== 'ready') return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <Dialog.Content className="fixed right-0 top-0 z-50 bg-card p-6 border border-border">
        <Dialog.Title>Detalhes do agendamento</Dialog.Title>
        {detail.status === 'loading' ? <p role="status">Carregando detalhes…</p> : <div role="alert">
          <p>{detail.error instanceof ApiClientError && detail.error.status === 404 ? 'Agendamento não encontrado.' : `Falha ao carregar detalhes: ${detail.error instanceof Error ? detail.error.message : 'falha de conexão'}`}</p>
          <button type="button" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</button>
        </div>}
        <Dialog.Close>Fechar</Dialog.Close>
      </Dialog.Content></Dialog.Portal></Dialog.Root>;
  const loaded = detail.data;
  const current = { ...mapJobListItemToDomain(loaded, contacts, []), text: loaded.content };
  return <InspectorContent key={id} job={current} open={open} onOpenChange={onOpenChange} onChanged={() => setRevision((n) => n + 1)} />;
}

function InspectorContent({ job: currentJob, open, onOpenChange, onChanged }: { job: Job; open: boolean; onOpenChange: (open: boolean) => void; onChanged: () => void }) {
  const { runJobNow, togglePauseResume, snoozeJob, rescheduleJob, cancelJob, retryJob } = useJobsStore();
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'projection'>('details');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newRunAt, setNewRunAt] = useState('');
  const [newCron, setNewCron] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [runsRevision, setRunsRevision] = useState(0);
  const [upcomingRevision, setUpcomingRevision] = useState(0);
  const loadRuns = useCallback(() => api.getJobRuns(currentJob.id, 20), [currentJob.id]);
  const loadUpcoming = useCallback(() => api.getUpcomingRuns(currentJob.id, 5), [currentJob.id]);
  const runs = useInspectorResource(currentJob.id, loadRuns, runsRevision);
  const upcoming = useInspectorResource(currentJob.id, loadUpcoming, upcomingRevision);
  const isYaml = currentJob.source === 'yaml';

  const rejectYaml = (): boolean => {
    if (!isYaml) return false;
    toast.error('Rotinas YAML são imutáveis (edite routines.yaml)');
    return true;
  };

  const mutate = async (feedback: MutationFeedback): Promise<boolean> => {
    setIsBusy(true);
    try {
      const accepted = await runWithFeedback(feedback);
      if (accepted) onChanged();
      return accepted;
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
                    Conteúdo armazenado
                  </span>
                  <div className="p-3 rounded-lg border border-border bg-background font-mono text-xs whitespace-pre-wrap text-foreground">
                    {currentJob.text ?? '—'}
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
                    <span className="font-mono text-foreground">{currentJob.recipient}{currentJob.recipient_alias ? ` (${currentJob.recipient_alias})` : ''}</span>
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

            {activeTab === 'history' && <div id="detail-runs-section" className="mt-4 space-y-2">
              <div className="flex justify-between"><span>Histórico de Disparos · até 20 tentativas</span><button id="btn-refresh-runs" type="button" onClick={() => setRunsRevision((n) => n + 1)}>Atualizar</button></div>
              {runs.status === 'loading' && <p id="runs-loading" role="status">Carregando tentativas…</p>}
              {runs.status === 'error' && <p role="alert">Falha ao carregar tentativas: {runs.error instanceof Error ? runs.error.message : 'falha de conexão'}</p>}
              {runs.status === 'ready' && (runs.data.length === 0 ? <p id="runs-empty">Nenhuma tentativa registrada.</p> : <div id="runs-list">{runs.data.map((run) => <div key={run.id} className="border rounded p-3 text-xs">
                <p>{run.ran_at} · {run.trigger} · {run.status}</p><p>HTTP {run.status_code ?? '—'} · {run.duration_ms ?? '—'} ms</p>{run.error_message && <p>{run.error_message}</p>}
              </div>)}</div>)}
            </div>}
            {activeTab === 'projection' && <div id="detail-upcoming-card" className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between"><span>Próximas execuções · até 5</span><button id="btn-refresh-upcoming" type="button" onClick={() => setUpcomingRevision((n) => n + 1)}>Atualizar</button></div>
              {upcoming.status === 'loading' && <p id="upcoming-loading" role="status">Carregando projeção…</p>}
              {upcoming.status === 'error' && <p role="alert">Falha ao carregar projeção: {upcoming.error instanceof Error ? upcoming.error.message : 'falha de conexão'}</p>}
              {upcoming.status === 'ready' && (upcoming.data.runs.length === 0 ? <p id="upcoming-empty">Nenhuma próxima execução.</p> : <div id="upcoming-list">{upcoming.data.runs.map((item, index) => <p key={item.run_at}>#{index + 1} · {item.run_at_local}</p>)}</div>)}
            </div>}

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
