/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type JobStatus = 'scheduled' | 'done' | 'paused' | 'error' | 'snoozed';
export type JobSource = 'sqlite' | 'yaml';
export type ScheduleKind = 'once' | 'cron';

export interface JobRun {
  id: string;
  job_id: string;
  job_title: string;
  recipient: string;
  timestamp: string;
  relative_time?: string;
  trigger_mode?: 'scheduled' | 'manual';
  status_code: number;
  status: 'success' | 'failed' | 'retrying';
  duration_ms: number;
  payload_preview: string;
  rendered_payload?: string;
  error_message?: string;
  response_headers?: Record<string, string>;
  stack_trace?: string;
}

export interface Job {
  id: string;
  title: string;
  kind: ScheduleKind;
  status: JobStatus;
  source: JobSource;
  recipient: string;
  recipient_alias?: string;
  group_id?: string;
  run_at?: string;
  cron_expr?: string;
  cron_human?: string;
  message_type: 'direct' | 'template';
  text?: string;
  template_id?: string;
  variables?: Record<string, string>;
  tags: string[];
  created_by?: string;
  created_at?: string;
  next_run_at?: string;
  last_run_at?: string;
  last_status_code?: number;
  last_error?: string;
  retry_count?: number;
  max_retries?: number;
  runs_executed?: number;
  max_runs?: number;
  until?: string;
  snooze_until?: string;
  recent_runs?: JobRun[];
}

export interface Template {
  id: string;
  name: string;
  content: string;
  body?: string;
  variables: string[];
  placeholders?: string[];
  category?: string;
  updated_at?: string;
  jobs_count?: number;
}

export interface Contact {
  id: string;
  alias: string;
  name?: string;
  phone: string;
  role?: string;
  tags: string[];
  last_dispatch?: string;
  active?: boolean;
  active_jobs?: number;
  created_at?: string;
  updated_at?: string;
}

export interface HomelabConfig {
  baseUrl: string;
  apiKey: string;
  isConnected: boolean;
  lastPingMs: number;
  version: string;
  gatewayStatus: string;
}

export type AgendaViewMode = 'table' | 'timeline' | 'calendar';

export interface AgendaFilterState {
  searchQuery: string;
  statusFilter: 'all' | JobStatus;
  selectedTag: string | null;
  viewMode: AgendaViewMode;
}
