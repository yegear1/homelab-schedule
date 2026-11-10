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

export const YAML_IMMUTABLE_MESSAGE = 'Rotinas YAML são imutáveis via interface (edite routines.yaml)';

/** Raised when a write for the same job, group or composer is still running. */
export class MutationInFlightError extends Error {
  constructor() {
    super('Já existe uma operação em andamento para este item');
    this.name = 'MutationInFlightError';
  }
}

/** `refreshed` is false when the server accepted the write but the follow-up read failed. */
export interface MutationOutcome { refreshed: boolean }

const inFlight = new Set<string>();

function _snoozeWhen(duration: string): string {
  return duration.toLowerCase().includes('hour') ? '+1h' : duration;
}

function _requireJob(id: string, options: { mutable: boolean } = { mutable: true }): Job {
  const job = useJobsStore.getState().jobs.find((j) => j.id === id);
  if (!job) throw new Error('Agendamento não encontrado na lista carregada; atualize a agenda');
  if (options.mutable && job.source === 'yaml') throw new Error(YAML_IMMUTABLE_MESSAGE);
  return job;
}

/**
 * Sends one write. State changes only from the server response: on failure nothing is
 * mutated locally and the error propagates; on success the read model is refreshed
 * separately. Nothing is ever retried automatically, and the key stays locked until the
 * refresh settles so a second submit cannot replay the write.
 */
async function _mutate(
  key: string,
  action: () => Promise<unknown>,
  options: { refreshTags?: boolean } = {},
): Promise<MutationOutcome> {
  if (inFlight.has(key)) throw new MutationInFlightError();
  inFlight.add(key);
  useJobsStore.setState({ pendingMutations: [...inFlight] });
  try {
    await action();
    const store = useJobsStore.getState();
    await Promise.all([store.fetchJobs(), options.refreshTags ? store.fetchTags() : Promise.resolve()]);
    return { refreshed: useJobsStore.getState().resources.jobs.status !== 'error' };
  } finally {
    inFlight.delete(key);
    useJobsStore.setState({ pendingMutations: [...inFlight] });
  }
}

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
  /** Keys (`job:<id>`, `group:<id>`, `create`) with a write in flight. */
  pendingMutations: string[];

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
  runJobNow: (id: string) => Promise<MutationOutcome>;
  togglePauseResume: (id: string) => Promise<MutationOutcome>;
  snoozeJob: (id: string, snoozeDuration: string) => Promise<MutationOutcome>;
  rescheduleJob: (id: string, newTiming: { run_at?: string; cron_expr?: string }) => Promise<MutationOutcome>;
  cancelJob: (id: string) => Promise<MutationOutcome>;
  retryJob: (id: string) => Promise<MutationOutcome>;
  createJob: (jobData: Partial<Job>, recipients: string[]) => Promise<MutationOutcome>;
  exportCsv: () => Promise<void>;

  // Group Operations
  runGroup: (groupId: string) => Promise<MutationOutcome>;
  togglePauseResumeGroup: (groupId: string, pause: boolean) => Promise<MutationOutcome>;
  snoozeGroup: (groupId: string, snoozeDuration: string) => Promise<MutationOutcome>;
  cancelGroup: (groupId: string) => Promise<MutationOutcome>;
  retryGroup: (groupId: string) => Promise<MutationOutcome>;

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
  pendingMutations: [],

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
    _requireJob(id, { mutable: false });
    return _mutate(`job:${id}`, () => api.runJob(id));
  },

  togglePauseResume: async (id: string) => {
    const job = _requireJob(id);
    return _mutate(`job:${id}`, () => (job.status === 'paused' ? api.resumeJob(id) : api.pauseJob(id)));
  },

  snoozeJob: async (id: string, snoozeDuration: string) => {
    _requireJob(id);
    return _mutate(`job:${id}`, () => api.snoozeJob(id, { when: _snoozeWhen(snoozeDuration) }));
  },

  rescheduleJob: async (id: string, { run_at, cron_expr }) => {
    _requireJob(id);
    return _mutate(`job:${id}`, () => api.rescheduleJob(id, { run_at, cron_expr }));
  },

  retryJob: async (id: string) => {
    _requireJob(id);
    return _mutate(`job:${id}`, () => api.retryJob(id));
  },

  cancelJob: async (id: string) => {
    _requireJob(id);
    const outcome = await _mutate(`job:${id}`, () => api.cancelJob(id));
    set((state) => ({
      selectedJobId: state.selectedJobId === id ? null : state.selectedJobId,
      isInspectorOpen: state.selectedJobId === id ? false : state.isInspectorOpen,
    }));
    return outcome;
  },

  createJob: async (jobData: Partial<Job>, recipients: string[]) => {
    const cleanRecipients = recipients.map((r) => r.trim()).filter(Boolean);
    if (cleanRecipients.length === 0) {
      throw new Error('Ao menos um destinatário é obrigatório');
    }
    const common = {
      content: jobData.message_type === 'direct' ? (jobData.text || '') : undefined,
      kind: jobData.kind || 'once',
      run_at: jobData.kind === 'once' ? jobData.run_at : undefined,
      cron_expr: jobData.kind === 'cron' ? jobData.cron_expr : undefined,
      created_by: jobData.created_by,
      template_id: jobData.message_type === 'template' ? jobData.template_id : undefined,
      variables: jobData.variables,
      tags: jobData.tags,
      until: jobData.until,
      max_runs: jobData.max_runs,
    } as const;
    const request = cleanRecipients.length === 1
      ? () => api.createJob({ ...common, title: jobData.title || 'Untitled Job', to: cleanRecipients[0] })
      : () => api.createBatchJobs({ ...common, title: jobData.title || 'Untitled Batch Job', recipients: cleanRecipients });
    return _mutate('create', request, { refreshTags: true });
  },

  // Group Operations
  runGroup: async (groupId: string) => _mutate(`group:${groupId}`, () => api.runGroup(groupId)),

  togglePauseResumeGroup: async (groupId: string, pause: boolean) =>
    _mutate(`group:${groupId}`, () => (pause ? api.pauseGroup(groupId) : api.resumeGroup(groupId))),

  snoozeGroup: async (groupId: string, snoozeDuration: string) =>
    _mutate(`group:${groupId}`, () => api.snoozeGroup(groupId, { when: _snoozeWhen(snoozeDuration) })),

  cancelGroup: async (groupId: string) => _mutate(`group:${groupId}`, () => api.cancelGroup(groupId)),

  retryGroup: async (groupId: string) => _mutate(`group:${groupId}`, () => api.retryGroup(groupId)),


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
    const created = await api.createContact({ name: data.name, phone: data.phone });
    const contact: Contact = { ...created, alias: created.name, tags: [] };
    ++generations.contacts;
    set((state) => ({ contacts: [contact, ...state.contacts], resources: { ...state.resources, contacts: { status: "ready", stale: false } } }));
    return contact;
  },

  updateContact: async (id, updates) => {
    const updated = await api.patchContact(id, { name: updates.name, phone: updates.phone });
    ++generations.contacts;
    set((state) => ({ contacts: state.contacts.map((c) => c.id === id
      ? { ...updated, alias: updated.name, tags: [] } : c), resources: { ...state.resources, contacts: { status: "ready", stale: false } } }));
  },

  deleteContact: async (id) => {
    await api.deleteContact(id);
    ++generations.contacts;
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
      resources: { ...state.resources, contacts: { status: "ready", stale: false } },
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
    const created = await api.createTemplate(data);
    const placeholders = (created.body.match(/\{\{([^}]+)\}\}/g) || []).map((m) => m.replace(/[{}]/g, '').trim());
    const template: Template = { ...created, content: created.body, variables: placeholders, placeholders };
    ++generations.templates;
    set((state) => ({ templates: [template, ...state.templates], resources: { ...state.resources, templates: { status: "ready", stale: false } } }));
    return template;
  },

  updateTemplate: async (id, updates) => {
    const updated = await api.patchTemplate(id, updates);
    const placeholders = (updated.body.match(/\{\{([^}]+)\}\}/g) || []).map((m) => m.replace(/[{}]/g, '').trim());
    ++generations.templates;
    set((state) => ({ templates: state.templates.map((t) => t.id === id
      ? { ...updated, content: updated.body, variables: placeholders, placeholders } : t), resources: { ...state.resources, templates: { status: "ready", stale: false } } }));
  },

  deleteTemplate: async (id) => {
    await api.deleteTemplate(id);
    ++generations.templates;
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
      resources: { ...state.resources, templates: { status: "ready", stale: false } },
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
