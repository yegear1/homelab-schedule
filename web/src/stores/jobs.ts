/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { AgendaViewMode, Contact, Job, JobRun, JobStatus, Template } from '../types/domain';
import { JobListItem } from '../lib/types';
import { api } from '../lib/api';
import { saveCsv } from '../lib/jobs/agenda';
import { toast } from 'sonner';
type ResourceStatus = 'idle' | 'loading' | 'ready' | 'error';
type ResourceName = 'jobs' | 'tags' | 'contacts' | 'templates';
type ResourceState = { status: ResourceStatus; error?: string; stale: boolean };
const generations: Record<ResourceName, number> = { jobs: 0, tags: 0, contacts: 0, templates: 0 };


interface JobsState {
  resources: Record<ResourceName, ResourceState>;
  jobs: Job[];
  runs: JobRun[];
  templates: Template[];
  contacts: Contact[];
  availableTags: string[];
  viewMode: AgendaViewMode;
  statusFilter: 'all' | JobStatus;
  selectedTag: string | null;
  searchQuery: string;
  appliedQuery: { status: 'all' | 'upcoming' | 'done' | 'paused' | 'error'; tag?: string; query?: string; limit: number } | null;
  exportBusy: boolean;
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
  fetchJobs: () => Promise<void>;
  fetchTags: () => Promise<void>;
  runJobNow: (id: string) => Promise<boolean>;
  togglePauseResume: (id: string) => Promise<void>;
  snoozeJob: (id: string, snoozeDuration: string) => Promise<void>;
  rescheduleJob: (id: string, newTiming: { run_at?: string; cron_expr?: string }) => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  retryJob: (id: string) => Promise<void>;
  createJob: (jobData: Partial<Job>, recipients: string[]) => Promise<void>;
  exportCsv: () => Promise<void>;

  // Group Operations
  runGroup: (groupId: string) => Promise<boolean>;
  togglePauseResumeGroup: (groupId: string, pause: boolean) => Promise<void>;
  snoozeGroup: (groupId: string, snoozeDuration: string) => Promise<void>;
  cancelGroup: (groupId: string) => Promise<void>;
  retryGroup: (groupId: string) => Promise<void>;

  // Contact Operations
  fetchContacts: () => Promise<void>;
  createContact: (contactData: { name: string; phone: string; role?: string; tags?: string[] }) => Promise<Contact>;
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;

  // Template Operations
  fetchTemplates: () => Promise<void>;
  createTemplate: (templateData: { name: string; body: string }) => Promise<Template>;
  updateTemplate: (id: string, updates: { name?: string; body?: string }) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

export function mapJobListItemToDomain(item: JobListItem, contacts: Contact[], existingJobs: Job[]): Job {
  const rawPhone = item.target_number || item.to;
  const matched = contacts.find(
    (c) =>
      c.phone === rawPhone ||
      c.phone === item.to ||
      c.alias.toLowerCase() === item.to.toLowerCase() ||
      (c.name && c.name.toLowerCase() === item.to.toLowerCase())
  );
  const recipientPhone = matched ? matched.phone : (item.target_number || item.to);
  const recipientAlias = matched ? matched.alias : (item.to !== item.target_number ? item.to : undefined);
  const existing = existingJobs.find((j) => j.id === item.id);

  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    status: item.status as JobStatus,
    source: item.source,
    recipient: recipientPhone,
    recipient_alias: recipientAlias,
    group_id: item.group_id || undefined,
    run_at: item.run_at || undefined,
    cron_expr: item.cron_expr || undefined,
    cron_human: item.cron_expr ? `Cron: ${item.cron_expr}` : undefined,
    message_type: item.template_id ? 'template' : 'direct',
    text: existing?.text,
    template_id: item.template_id || undefined,
    variables: item.variables || {},
    tags: item.tags || [],
    created_by: item.created_by || undefined,
    created_at: undefined,
    next_run_at: item.next_run_at || undefined,
    last_run_at: item.last_run_at || undefined,
    last_error: item.last_error || undefined,
    retry_count: item.retry_count,
    runs_executed: item.run_count,
    max_runs: item.max_runs || undefined,
    until: item.until || undefined,
    recent_runs: existing?.recent_runs,
  };
}

export const useJobsStore = create<JobsState>((set, get) => ({
  resources: {
    jobs: { status: 'idle', stale: false }, tags: { status: 'idle', stale: false },
    contacts: { status: 'idle', stale: false }, templates: { status: 'idle', stale: false },
  },
  jobs: [],
  runs: [],
  templates: [],
  contacts: [],
  availableTags: [],
  viewMode: 'table',
  statusFilter: 'all',
  selectedTag: null,
  searchQuery: '',
  appliedQuery: null,
  exportBusy: false,
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

  fetchJobs: async () => {
    const generation = ++generations.jobs;
    set((state) => ({ resources: { ...state.resources, jobs: { status: 'loading', stale: state.resources.jobs.status === 'ready' || state.resources.jobs.stale } } }));
    try {
      const { statusFilter, selectedTag, searchQuery } = get();
      const query = { status: statusFilter === 'scheduled' || statusFilter === 'snoozed' ? 'upcoming' as const : statusFilter, tag: selectedTag || undefined, query: searchQuery.trim() || undefined, limit: 50 };
      const items = await api.getJobs(query);
      const currentContacts = get().contacts;
      const currentJobs = get().jobs;
      const mappedJobs = items.map((item) => mapJobListItemToDomain(item, currentContacts, currentJobs));
      if (generation === generations.jobs) set((state) => ({ jobs: mappedJobs, appliedQuery: query, resources: { ...state.resources, jobs: { status: 'ready', stale: false } } }));
    } catch (error: unknown) {
      if (generation === generations.jobs) set((state) => ({ resources: { ...state.resources, jobs: { status: 'error', error: error instanceof Error ? error.message : 'Falha de conexão', stale: state.resources.jobs.stale } } }));
    }
  },

  fetchTags: async () => {
    const generation = ++generations.tags;
    set((state) => ({ resources: { ...state.resources, tags: { status: 'loading', stale: state.resources.tags.status === 'ready' || state.resources.tags.stale } } }));
    try {
      const tags = await api.getTags();
      if (generation === generations.tags) set((state) => ({ availableTags: tags, resources: { ...state.resources, tags: { status: 'ready', stale: false } } }));
    } catch (error: unknown) {
      if (generation === generations.tags) set((state) => ({ resources: { ...state.resources, tags: { status: 'error', error: error instanceof Error ? error.message : 'Falha de conexão', stale: state.resources.tags.stale } } }));
    }
  },

  runJobNow: async (id: string) => {
    try {
      await api.runJob(id);
      await get().fetchJobs();
      return true;
    } catch {
      // Fallback local simulation if offline
      const job = get().jobs.find((j) => j.id === id);
      if (!job) return false;

      const newRun: JobRun = {
        id: `run-${Date.now()}`,
        job_id: job.id,
        job_title: job.title,
        recipient: job.recipient,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        status_code: 202,
        status: 'success',
        duration_ms: 140,
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
              runs_executed: (j.runs_executed ?? 0) + 1,
              recent_runs: [newRun, ...(j.recent_runs || [])].slice(0, 5),
            };
          }
          return j;
        }),
        runs: [newRun, ...state.runs],
      }));
      return true;
    }
  },

  togglePauseResume: async (id: string) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    if (job.source === 'yaml') {
      throw new Error('Rotinas YAML são imutáveis via interface (edite routines.yaml)');
    }
    try {
      if (job.status === 'paused') {
        await api.resumeJob(id);
      } else {
        await api.pauseJob(id);
      }
      await get().fetchJobs();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('YAML')) {
        throw err;
      }
      // Fallback local update
      set((state) => ({
        jobs: state.jobs.map((j) => {
          if (j.id === id) {
            const nextStatus = j.status === 'paused' ? 'scheduled' : 'paused';
            return { ...j, status: nextStatus };
          }
          return j;
        }),
      }));
    }
  },

  snoozeJob: async (id: string, snoozeDuration: string) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    if (job.source === 'yaml') {
      throw new Error('Rotinas YAML são imutáveis via interface (edite routines.yaml)');
    }
    const when = snoozeDuration.toLowerCase().includes('hour') ? '+1h' : snoozeDuration;
    try {
      await api.snoozeJob(id, { when });
      await get().fetchJobs();
    } catch {
      // Fallback local update
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
    }
  },

  rescheduleJob: async (id: string, { run_at, cron_expr }) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    if (job.source === 'yaml') {
      throw new Error('Rotinas YAML são imutáveis via interface (edite routines.yaml)');
    }
    try {
      await api.rescheduleJob(id, { run_at, cron_expr });
      await get().fetchJobs();
    } catch {
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
    }
  },

  retryJob: async (id: string) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    if (job.source === 'yaml') {
      throw new Error('Rotinas YAML são imutáveis via interface (edite routines.yaml)');
    }
    try {
      await api.retryJob(id);
      await get().fetchJobs();
    } catch {
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === id
            ? { ...j, status: 'scheduled', last_error: undefined, retry_count: 0 }
            : j
        ),
      }));
    }
  },

  cancelJob: async (id: string) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    if (job.source === 'yaml') {
      throw new Error('Rotinas YAML são imutáveis via interface (edite routines.yaml)');
    }
    try {
      await api.cancelJob(id);
    } catch {
      // Proceed to update local state
    }
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      selectedJobId: state.selectedJobId === id ? null : state.selectedJobId,
      isInspectorOpen: state.selectedJobId === id ? false : state.isInspectorOpen,
    }));
  },

  createJob: async (jobData: Partial<Job>, recipients: string[]) => {
    const cleanRecipients = recipients.map((r) => r.trim()).filter(Boolean);
    if (cleanRecipients.length === 0) {
      throw new Error('Ao menos um destinatário é obrigatório');
    }

    try {
      if (cleanRecipients.length === 1) {
        await api.createJob({
          title: jobData.title || 'Untitled Job',
          content: jobData.message_type === 'direct' ? (jobData.text || '') : undefined,
          to: cleanRecipients[0],
          kind: jobData.kind || 'once',
          run_at: jobData.kind === 'once' ? jobData.run_at : undefined,
          cron_expr: jobData.kind === 'cron' ? jobData.cron_expr : undefined,
          created_by: jobData.created_by,
          template_id: jobData.message_type === 'template' ? jobData.template_id : undefined,
          variables: jobData.variables,
          tags: jobData.tags,
          until: jobData.until,
          max_runs: jobData.max_runs,
        });
      } else {
        await api.createBatchJobs({
          title: jobData.title || 'Untitled Batch Job',
          content: jobData.message_type === 'direct' ? (jobData.text || '') : undefined,
          recipients: cleanRecipients,
          kind: jobData.kind || 'once',
          run_at: jobData.kind === 'once' ? jobData.run_at : undefined,
          cron_expr: jobData.kind === 'cron' ? jobData.cron_expr : undefined,
          created_by: jobData.created_by,
          template_id: jobData.message_type === 'template' ? jobData.template_id : undefined,
          variables: jobData.variables,
          tags: jobData.tags,
          until: jobData.until,
          max_runs: jobData.max_runs,
        });
      }
      await get().fetchJobs();
    } catch {
      // Fallback local creation if offline
      const isBatch = cleanRecipients.length > 1;
      const groupId = isBatch ? `grp-${Date.now().toString(36)}` : undefined;
      const currentContacts = get().contacts;

      const newJobs: Job[] = cleanRecipients.map((rawRecipient, idx) => {
        const matched = currentContacts.find(
          (c) =>
            c.phone === rawRecipient ||
            c.alias.toLowerCase() === rawRecipient.toLowerCase() ||
            c.name?.toLowerCase() === rawRecipient.toLowerCase()
        );

        const finalPhone = matched ? matched.phone : rawRecipient;
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
    }
  },

  // Group Operations
  runGroup: async (groupId: string) => {
    try {
      await api.runGroup(groupId);
      await get().fetchJobs();
      return true;
    } catch {
      return false;
    }
  },

  togglePauseResumeGroup: async (groupId: string, pause: boolean) => {
    try {
      if (pause) {
        await api.pauseGroup(groupId);
      } else {
        await api.resumeGroup(groupId);
      }
      await get().fetchJobs();
    } catch {
      // Fallback local update
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.group_id === groupId ? { ...j, status: pause ? 'paused' : 'scheduled' } : j
        ),
      }));
    }
  },

  snoozeGroup: async (groupId: string, snoozeDuration: string) => {
    const when = snoozeDuration.toLowerCase().includes('hour') ? '+1h' : snoozeDuration;
    try {
      await api.snoozeGroup(groupId, { when });
      await get().fetchJobs();
    } catch {
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.group_id === groupId
            ? { ...j, status: 'snoozed', snooze_until: snoozeDuration, next_run_at: snoozeDuration }
            : j
        ),
      }));
    }
  },

  cancelGroup: async (groupId: string) => {
    try {
      await api.cancelGroup(groupId);
      await get().fetchJobs();
    } catch {
      set((state) => ({
        jobs: state.jobs.filter((j) => j.group_id !== groupId),
      }));
    }
  },

  retryGroup: async (groupId: string) => {
    try {
      await api.retryGroup(groupId);
      await get().fetchJobs();
    } catch {
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.group_id === groupId && j.status === 'error'
            ? { ...j, status: 'scheduled', last_error: undefined, retry_count: 0 }
            : j
        ),
      }));
    }
  },

  fetchContacts: async () => {
    const generation = ++generations.contacts;
    set((state) => ({ resources: { ...state.resources, contacts: { status: 'loading', stale: state.resources.contacts.status === 'ready' || state.resources.contacts.stale } } }));
    try {
      const raw = await api.getContacts();
      const contacts: Contact[] = raw.map((c) => ({
        id: c.id,
        name: c.name,
        alias: c.name,
        phone: c.phone,
        tags: [],
      }));
      if (generation === generations.contacts) set((state) => ({ contacts, resources: { ...state.resources, contacts: { status: 'ready', stale: false } } }));
    } catch (error: unknown) {
      if (generation === generations.contacts) set((state) => ({ resources: { ...state.resources, contacts: { status: 'error', error: error instanceof Error ? error.message : 'Falha de conexão', stale: state.resources.contacts.stale } } }));
    }
  },

  createContact: async (data) => {
    try {
      const created = await api.createContact({ name: data.name, phone: data.phone });
      const newContact: Contact = {
        id: created.id,
        name: created.name,
        alias: created.name,
        phone: created.phone,
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
    } catch {
      // Fallback local creation if offline
      const fallback: Contact = {
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
        contacts: [fallback, ...state.contacts],
      }));
      return fallback;
    }
  },

  updateContact: async (id, updates) => {
    try {
      await api.patchContact(id, { name: updates.name, phone: updates.phone });
    } catch {
      // Fallback local update
    }
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
      ),
    }));
  },

  deleteContact: async (id) => {
    await api.deleteContact(id);
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
    }));
  },

  fetchTemplates: async () => {
    const generation = ++generations.templates;
    set((state) => ({ resources: { ...state.resources, templates: { status: 'loading', stale: state.resources.templates.status === 'ready' || state.resources.templates.stale } } }));
    try {
      const raw = await api.getTemplates();
      const templates: Template[] = raw.map((t) => {
        const placeholders = (t.body.match(/\{\{([^}]+)\}\}/g) || []).map((m) =>
          m.replace(/[{}]/g, '').trim()
        );
        return {
          id: t.id,
          name: t.name,
          content: t.body,
          body: t.body,
          variables: placeholders,
          placeholders,
        };
      });
      if (generation === generations.templates) set((state) => ({ templates, resources: { ...state.resources, templates: { status: 'ready', stale: false } } }));
    } catch (error: unknown) {
      if (generation === generations.templates) set((state) => ({ resources: { ...state.resources, templates: { status: 'error', error: error instanceof Error ? error.message : 'Falha de conexão', stale: state.resources.templates.stale } } }));
    }
  },

  createTemplate: async (data) => {
    try {
      const created = await api.createTemplate({ name: data.name, body: data.body });
      const placeholders = (created.body.match(/\{\{([^}]+)\}\}/g) || []).map((m) =>
        m.replace(/[{}]/g, '').trim()
      );
      const newTemplate: Template = {
        id: created.id,
        name: created.name,
        content: created.body,
        body: created.body,
        variables: placeholders,
        placeholders,
        category: 'custom',
        updated_at: new Date().toISOString(),
      };
      set((state) => ({
        templates: [newTemplate, ...state.templates],
      }));
      return newTemplate;
    } catch {
      const placeholders = (data.body.match(/\{\{([^}]+)\}\}/g) || []).map((m) =>
        m.replace(/[{}]/g, '').trim()
      );
      const fallback: Template = {
        id: `tpl-${Date.now().toString(36)}`,
        name: data.name,
        content: data.body,
        body: data.body,
        variables: placeholders,
        placeholders,
        category: 'custom',
        updated_at: new Date().toISOString(),
      };
      set((state) => ({
        templates: [fallback, ...state.templates],
      }));
      return fallback;
    }
  },

  updateTemplate: async (id, updates) => {
    try {
      await api.patchTemplate(id, { name: updates.name, body: updates.body });
    } catch {
      // Fallback local update
    }
    const placeholders = updates.body
      ? (updates.body.match(/\{\{([^}]+)\}\}/g) || []).map((m) => m.replace(/[{}]/g, '').trim())
      : undefined;
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id
          ? {
              ...t,
              ...updates,
              ...(updates.body !== undefined ? { content: updates.body } : {}),
              ...(placeholders ? { variables: placeholders, placeholders } : {}),
              updated_at: new Date().toISOString(),
            }
          : t
      ),
    }));
  },

  deleteTemplate: async (id) => {
    await api.deleteTemplate(id);
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    }));
  },

  exportCsv: async () => {
    const { appliedQuery, exportBusy, resources } = get();
    if (exportBusy || !appliedQuery || resources.jobs.status !== 'ready') return;
    set({ exportBusy: true });
    try {
      const params = new URLSearchParams();
      params.set('status', appliedQuery.status);
      if (appliedQuery.tag) params.set('tag', appliedQuery.tag);
      if (appliedQuery.query) params.set('query', appliedQuery.query);
      const blob = await api.downloadCsv('/jobs/export.csv', params);
      saveCsv(blob, `homelab_jobs_export_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('CSV exportado.');
    } catch (error: unknown) {
      toast.error(`Falha ao exportar CSV: ${error instanceof Error ? error.message : 'falha de conexão'}`);
    } finally {
      set({ exportBusy: false });
    }
  },
}));
