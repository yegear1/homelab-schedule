/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { AgendaViewMode, Contact, Job, JobRun, JobStatus, Template } from '../types/domain';
import {
  INITIAL_AVAILABLE_TAGS,
  INITIAL_CONTACTS,
  INITIAL_JOBS,
  INITIAL_JOB_RUNS,
  INITIAL_TEMPLATES,
} from '../features/agenda/agenda.fixtures';

interface JobsState {
  jobs: Job[];
  runs: JobRun[];
  templates: Template[];
  contacts: Contact[];
  availableTags: string[];
  viewMode: AgendaViewMode;
  statusFilter: 'all' | JobStatus;
  selectedTag: string | null;
  searchQuery: string;
  selectedJobId: string | null;
  isInspectorOpen: boolean;
  isCreateOpen: boolean;
  
  // Actions
  setViewMode: (mode: AgendaViewMode) => void;
  setStatusFilter: (status: 'all' | JobStatus) => void;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  openInspector: (jobId: string) => void;
  closeInspector: () => void;
  setIsCreateOpen: (open: boolean) => void;
  
  // Job Operations
  runJobNow: (id: string) => Promise<boolean>;
  togglePauseResume: (id: string) => void;
  snoozeJob: (id: string, snoozeDuration: string) => void;
  rescheduleJob: (id: string, newTiming: { run_at?: string; cron_expr?: string }) => void;
  cancelJob: (id: string) => void;
  createJob: (jobData: Partial<Job>, recipients: string[]) => void;
  exportCsv: () => void;

  // Contact Operations
  createContact: (contactData: { name: string; phone: string; role?: string; tags?: string[] }) => Contact;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: INITIAL_JOBS,
  runs: INITIAL_JOB_RUNS,
  templates: INITIAL_TEMPLATES,
  contacts: INITIAL_CONTACTS,
  availableTags: INITIAL_AVAILABLE_TAGS,
  viewMode: 'table',
  statusFilter: 'all',
  selectedTag: null,
  searchQuery: '',
  selectedJobId: null,
  isInspectorOpen: false,
  isCreateOpen: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  openInspector: (jobId) => set({ selectedJobId: jobId, isInspectorOpen: true }),
  closeInspector: () => set({ isInspectorOpen: false, selectedJobId: null }),
  setIsCreateOpen: (open) => set({ isCreateOpen: open }),

  runJobNow: async (id: string) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return false;

    // Simulate dispatch to gateway
    await new Promise((r) => setTimeout(r, 300));

    const newRun: JobRun = {
      id: `run-${Date.now()}`,
      job_id: job.id,
      job_title: job.title,
      recipient: job.recipient,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status_code: 202,
      status: 'success',
      duration_ms: Math.floor(Math.random() * 80) + 140,
      payload_preview: job.text || (job.template_id ? `Rendered template ${job.template_id}` : 'Manual dispatch trigger'),
    };

    set((state) => ({
      jobs: state.jobs.map((j) => {
        if (j.id === id) {
          return {
            ...j,
            status: j.kind === 'once' ? 'done' : j.status,
            last_run_at: newRun.timestamp,
            last_status_code: 202,
            last_error: undefined,
            runs_executed: j.runs_executed + 1,
            recent_runs: [newRun, ...(j.recent_runs || [])].slice(0, 5),
          };
        }
        return j;
      }),
      runs: [newRun, ...state.runs],
    }));

    return true;
  },

  togglePauseResume: (id: string) => {
    set((state) => ({
      jobs: state.jobs.map((j) => {
        if (j.id === id) {
          const nextStatus = j.status === 'paused' ? 'scheduled' : 'paused';
          return { ...j, status: nextStatus };
        }
        return j;
      }),
    }));
  },

  snoozeJob: (id: string, snoozeDuration: string) => {
    set((state) => ({
      jobs: state.jobs.map((j) => {
        if (j.id === id) {
          return {
            ...j,
            status: 'snoozed',
            snooze_until: snoozeDuration,
            next_run_at: snoozeDuration,
          };
        }
        return j;
      }),
    }));
  },

  rescheduleJob: (id: string, { run_at, cron_expr }) => {
    set((state) => ({
      jobs: state.jobs.map((j) => {
        if (j.id === id) {
          return {
            ...j,
            run_at: run_at || j.run_at,
            cron_expr: cron_expr || j.cron_expr,
            status: 'scheduled',
            next_run_at: run_at ? new Date(run_at).toLocaleString() : j.next_run_at,
          };
        }
        return j;
      }),
    }));
  },

  cancelJob: (id: string) => {
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      selectedJobId: state.selectedJobId === id ? null : state.selectedJobId,
      isInspectorOpen: state.selectedJobId === id ? false : state.isInspectorOpen,
    }));
  },

  createJob: (jobData: Partial<Job>, recipients: string[]) => {
    const isBatch = recipients.length > 1;
    const groupId = isBatch ? `grp-${Date.now().toString(36)}` : undefined;
    const currentContacts = get().contacts;

    const newJobs: Job[] = recipients.map((rawRecipient, idx) => {
      const trimmed = rawRecipient.trim();
      // Match contact by phone, alias, or name
      const matched = currentContacts.find(
        (c) =>
          c.phone === trimmed ||
          c.alias.toLowerCase() === trimmed.toLowerCase() ||
          c.name?.toLowerCase() === trimmed.toLowerCase()
      );

      const finalPhone = matched ? matched.phone : trimmed;
      const finalAlias = matched ? matched.alias : (jobData.recipient_alias || undefined);

      return {
        id: `job-${Date.now()}-${idx}`,
        title: jobData.title || 'Untitled Job',
        kind: jobData.kind || 'once',
        status: 'scheduled',
        source: 'sqlite',
        recipient: finalPhone,
        recipient_alias: finalAlias,
        group_id: groupId,
        run_at: jobData.run_at,
        cron_expr: jobData.cron_expr,
        cron_human: jobData.cron_human,
        message_type: jobData.message_type || 'direct',
        text: jobData.text,
        template_id: jobData.template_id,
        variables: jobData.variables || {},
        tags: jobData.tags || ['alerts'],
        created_by: jobData.created_by || 'operator',
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        next_run_at: jobData.kind === 'once' ? (jobData.run_at || 'Soon') : 'Next matching cron cycle',
        retry_count: 0,
        runs_executed: 0,
        max_runs: jobData.max_runs,
        until: jobData.until,
      };
    });

    set((state) => ({
      jobs: [...newJobs, ...state.jobs],
    }));
  },

  createContact: (data) => {
    const newContact: Contact = {
      id: `cnt-${Date.now().toString(36)}`,
      name: data.name,
      alias: data.name,
      phone: data.phone,
      role: data.role || 'Resident',
      tags: data.tags || ['custom'],
      active_jobs: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_dispatch: 'Never',
      active: true,
    };
    set((state) => ({
      contacts: [newContact, ...state.contacts],
    }));
    return newContact;
  },

  updateContact: (id, updates) => {
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
      ),
    }));
  },

  deleteContact: (id) => {
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
    }));
  },

  exportCsv: () => {
    const { jobs } = get();
    const headers = ['id', 'title', 'kind', 'status', 'source', 'recipient', 'group_id', 'cron_expr', 'run_at', 'last_status_code', 'retry_count'];
    const rows = jobs.map((j) => [
      j.id,
      `"${(j.title || '').replace(/"/g, '""')}"`,
      j.kind,
      j.status,
      j.source,
      `"${j.recipient}"`,
      j.group_id || '',
      j.cron_expr || '',
      j.run_at || '',
      j.last_status_code || '',
      j.retry_count,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `homelab_jobs_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
}));
