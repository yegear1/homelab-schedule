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

export function AgendaPage() {
  const {
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
    fetchJobs();
    fetchTags();
    fetchContacts();
    fetchTemplates();
  }, [fetchJobs, fetchTags, fetchContacts, fetchTemplates]);

  // Filter jobs based on active search, status tab, and tag filter
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false;
      }

      // 2. Tag Filter
      if (selectedTag && !job.tags.includes(selectedTag)) {
        return false;
      }

      // 3. Search Query (title, recipient, or group_id)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = job.title.toLowerCase().includes(q);
        const matchesRecipient = job.recipient.toLowerCase().includes(q);
        const matchesAlias = (job.recipient_alias || '').toLowerCase().includes(q);
        const matchesGroup = (job.group_id || '').toLowerCase().includes(q);
        const matchesTags = job.tags.some((t) => t.toLowerCase().includes(q));

        if (!matchesTitle && !matchesRecipient && !matchesAlias && !matchesGroup && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, statusFilter, selectedTag, searchQuery]);

  const selectedJob = useMemo(() => {
    return jobs.find((j) => j.id === selectedJobId) || null;
  }, [jobs, selectedJobId]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>Engine: SQLite 3.46</span>
          <span>·</span>
          <span className="text-emerald-500 font-medium">Gateway 202 Ready</span>
        </div>
      </div>

      {/* KPI Cards */}
      <KpiSummary onFilterErrors={() => setStatusFilter('error')} />

      {/* Filters Bar & View Switcher */}
      <AgendaFilters onOpenCreate={() => setIsCreateOpen(true)} />

      {/* Active View Mode */}
      {viewMode === 'table' && (
        <JobsTable jobs={filteredJobs} onInspect={openInspector} />
      )}
      {viewMode === 'timeline' && (
        <JobsTimeline jobs={filteredJobs} onInspect={openInspector} />
      )}
      {viewMode === 'calendar' && (
        <JobsCalendar jobs={filteredJobs} onInspect={openInspector} />
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
