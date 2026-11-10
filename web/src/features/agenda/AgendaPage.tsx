import { ResourceNotice } from '../../components/ResourceNotice';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo } from 'react';
import { useJobsStore } from '../../stores/jobs';
import { KpiSummary } from './wdg-kpi-summary';
import { AgendaFilters } from './wdg-agenda-filters';
import { JobsTable } from './cmp-jobs-table';
import { JobsTimeline } from './cmp-jobs-timeline';
import { JobsCalendar } from './cmp-jobs-calendar';
import { JobInspector } from './wdg-job-inspector';
import { useAgendaRuns } from './use-agenda-runs';

export function AgendaPage() {
  const {
    resources,
    jobs,
    viewMode,
    statusFilter,
    selectedTag,
    searchQuery,
    selectedJobId,
    isInspectorOpen,
    setStatusFilter,
    openInspector,
    closeInspector,
    setIsCreateOpen,
    fetchJobs,
    fetchTags,
    fetchContacts,
    fetchTemplates,
  } = useJobsStore();

  useEffect(() => {
    fetchTags();
    fetchContacts();
    fetchTemplates();
  }, [fetchTags, fetchContacts, fetchTemplates]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchJobs(); }, searchQuery ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [fetchJobs, statusFilter, selectedTag, searchQuery]);

  const { runs, state: runState, refresh: refreshRuns } = useAgendaRuns(viewMode !== 'table');
  const filteredJobs = jobs;

  const selectedJob = useMemo(() => {
    return jobs.find((j) => j.id === selectedJobId) || null;
  }, [jobs, selectedJobId]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <ResourceNotice label="agendamentos" {...resources.jobs} onRetry={() => { void fetchJobs(); }} />
      <ResourceNotice label="etiquetas" {...resources.tags} onRetry={() => { void fetchTags(); }} />
      <ResourceNotice label="contatos" {...resources.contacts} onRetry={() => { void fetchContacts(); }} />
      <ResourceNotice label="modelos" {...resources.templates} onRetry={() => { void fetchTemplates(); }} />
      {/* Page Title & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Operational Agenda & Dispatch Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active SQLite agenda daemon with WhatsApp / HTTP gateway webhook dispatching.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {(resources.jobs.status === 'ready' || resources.jobs.stale) && <KpiSummary onFilterErrors={() => setStatusFilter('error')} />}

      {/* Filters Bar & View Switcher */}
      <AgendaFilters onOpenCreate={() => setIsCreateOpen(true)} />

      {/* Active View Mode */}
      {(resources.jobs.status === 'ready' || resources.jobs.stale) && viewMode === 'table' && (
        <JobsTable jobs={filteredJobs} onInspect={openInspector} />
      )}
      {(resources.jobs.status === 'ready' || resources.jobs.stale) && viewMode === 'timeline' && (
        <JobsTimeline jobs={filteredJobs} runs={runs} runState={runState} refreshRuns={() => { void refreshRuns(); }} onInspect={openInspector} />
      )}
      {(resources.jobs.status === 'ready' || resources.jobs.stale) && viewMode === 'calendar' && (
        <JobsCalendar jobs={filteredJobs} runs={runs} runState={runState} refreshRuns={() => { void refreshRuns(); }} onInspect={openInspector} />
      )}

      {/* Inspector Slide-out Drawer */}
      <JobInspector
        job={selectedJob}
        open={isInspectorOpen}
        onOpenChange={(open) => {
          if (!open) closeInspector();
        }}
      />
    </div>
  );
}
