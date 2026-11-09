/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { api } from '../../lib/api';
import { ResourceNotice } from '../../components/ResourceNotice';
import { mapJobListItemToDomain } from '../../stores/jobs';
import { Play, Pause, Clock, Eye, Calendar, Repeat, AlertCircle } from 'lucide-react';
import { Contact, Job, JobStatus } from '../../types/domain';
import { StatusBadge, SourceBadge } from '../../components/wdg-status-badge';
import { useJobsStore } from '../../stores/jobs';
import { QUEUED_NOT_DELIVERED, runWithFeedback } from '../../lib/jobs/mutations';

export interface ContactJobsProps {
  contact: Contact;
  onInspectJob: (jobId: string) => void;
}

export function ContactJobs({ contact, onInspectJob }: ContactJobsProps) {
  const { contacts, runJobNow, togglePauseResume, snoozeJob } = useJobsStore();
  const [scopedJobs, setScopedJobs] = useState<Job[]>([]);
  const [readState, setReadState] = useState<{ status: 'loading' | 'ready' | 'error'; error?: string }>({ status: 'loading' });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setReadState({ status: 'loading' });
    api.getJobs({ status: 'all', phone: contact.phone, limit: 100 }).then((items) => {
      if (!current) return;
      setScopedJobs(items.map((item) => mapJobListItemToDomain(item, contacts, [])));
      setReadState({ status: 'ready' });
    }).catch((error: unknown) => {
      if (current) setReadState({ status: 'error', error: error instanceof Error ? error.message : 'Falha de conexão' });
    });
    return () => { current = false; };
  }, [contact.phone, contacts, refresh]);
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');

  // Derived filtered jobs based on active tab
  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return scopedJobs;
    return scopedJobs.filter((j) => j.status === statusFilter);
  }, [scopedJobs, statusFilter]);

  const counts = useMemo(() => ({
    all: scopedJobs.length,
    scheduled: scopedJobs.filter((j) => j.status === 'scheduled').length,
    done: scopedJobs.filter((j) => j.status === 'done').length,
    paused: scopedJobs.filter((j) => j.status === 'paused').length,
    error: scopedJobs.filter((j) => j.status === 'error').length,
  }), [scopedJobs]);

  const handleRunNow = async (job: Job) => {
    await runWithFeedback({
      id: `scoped-run-${job.id}`,
      pending: `Triggering ${job.title}...`,
      success: `Queued ${job.title}`,
      description: QUEUED_NOT_DELIVERED,
      failure: `Dispatch failed for ${job.title}`,
      action: () => runJobNow(job.id),
    });
  };

  return (
    <div className="space-y-4">
      <ResourceNotice label="agendamentos do contato" {...readState} stale={false} onRetry={() => setRefresh((n) => n + 1)} />
      {readState.status === 'ready' && <p className="text-xs text-muted-foreground">Resultados carregados para este contato: até 100.</p>}
      {readState.status === 'ready' && <>
      {/* Status filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'All', count: counts.all },
          { id: 'scheduled', label: 'Upcoming', count: counts.scheduled },
          { id: 'done', label: 'Done', count: counts.done },
          { id: 'paused', label: 'Paused', count: counts.paused },
          { id: 'error', label: 'Error', count: counts.error },
        ].map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as 'all' | JobStatus)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] active:scale-[0.98] ${
                isActive
                  ? 'bg-foreground text-background font-semibold shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.2 rounded-full bg-background/20">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Jobs Table */}
      {filteredJobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <AlertCircle className="mx-auto h-6 w-6 mb-2 opacity-40 text-sky-500" />
          <p className="text-xs font-medium text-foreground">No jobs found for this contact.</p>
          <p className="text-[11px] mt-1">Use &ldquo;Schedule Job for Contact&rdquo; to dispatch a new notification.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-2.5 px-3 min-w-[160px]">Job Title & Association</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Cadence</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredJobs.map((job) => {
                const isRecipient = job.recipient.toLowerCase() === contact.phone.toLowerCase();
                const isYaml = job.source === 'yaml';

                return (
                  <tr
                    key={job.id}
                    onClick={() => onInspectJob(job.id)}
                    className="hover:bg-muted/40 transition-colors cursor-pointer group text-xs"
                  >
                    <td className="py-3 px-3 max-w-xs min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">{job.title}</span>
                        <SourceBadge source={job.source} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden">
                        <span className="font-mono text-sky-500 shrink-0">
                          {isRecipient ? 'Recipient (to)' : 'Creator (by)'}
                        </span>
                        <span className="shrink-0">·</span>
                        <span className="font-mono truncate shrink-0">{job.next_run_at || 'Completed'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] tabular-nums whitespace-nowrap shrink-0">
                      {job.kind === 'cron' ? (
                        <div className="flex items-center gap-1.5 text-sky-500 font-medium whitespace-nowrap shrink-0">
                          <Repeat size={12} className="shrink-0" />
                          <span className="whitespace-nowrap">{job.cron_expr}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-foreground whitespace-nowrap shrink-0">
                          <Calendar size={12} className="text-muted-foreground shrink-0" />
                          <span className="whitespace-nowrap">Once</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap shrink-0">
                      <StatusBadge status={job.status} size="sm" />
                    </td>

                    <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleRunNow(job)}
                          title="Run Now"
                          className="p-1.5 text-sky-500 hover:bg-sky-500/10 rounded-md min-h-[36px] min-w-[36px] inline-flex items-center justify-center active:scale-[0.98]"
                        >
                          <Play size={12} className="fill-current" />
                        </button>
                        <button
                          type="button"
                          disabled={isYaml}
                          onClick={() => void runWithFeedback({
                            id: `scoped-pause-${job.id}`,
                            success: job.status === 'paused' ? 'Resumed' : 'Paused',
                            failure: `Could not change ${job.title}`,
                            action: () => togglePauseResume(job.id),
                          })}
                          title={isYaml ? 'Managed via routines.yaml' : 'Pause / Resume'}
                          className={`p-1.5 rounded-md min-h-[36px] min-w-[36px] inline-flex items-center justify-center active:scale-[0.98] ${
                            isYaml ? 'opacity-30 cursor-not-allowed' : 'text-amber-500 hover:bg-amber-500/10'
                          }`}
                        >
                          <Pause size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={isYaml}
                          onClick={() => void runWithFeedback({
                            id: `scoped-snooze-${job.id}`,
                            success: 'Snoozed for 1 hour',
                            failure: `Could not snooze ${job.title}`,
                            action: () => snoozeJob(job.id, 'In 1 hour'),
                          })}
                          title={isYaml ? 'Managed via routines.yaml' : 'Snooze'}
                          className={`p-1.5 rounded-md min-h-[36px] min-w-[36px] inline-flex items-center justify-center active:scale-[0.98] ${
                            isYaml ? 'opacity-30 cursor-not-allowed' : 'text-purple-500 hover:bg-purple-500/10'
                          }`}
                        >
                          <Clock size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onInspectJob(job.id)}
                          title="Inspect Job"
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md min-h-[36px] min-w-[36px] inline-flex items-center justify-center active:scale-[0.98]"
                        >
                          <Eye size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </>}
    </div>
  );
}
