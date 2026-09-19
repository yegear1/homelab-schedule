export type JobKind = 'once' | 'cron';
export type JobSource = 'sqlite' | 'yaml';
export type JobStatus = 'scheduled' | 'done' | 'paused' | 'error';
export type JobListFilter = 'upcoming' | 'done' | 'paused' | 'error' | 'all';

export interface Job {
  id: string;
  title: string;
  content: string;
  to: string;
  target_number: string;
  kind: JobKind;
  run_at: string | null;
  cron_expr: string | null;
  enabled: boolean;
  source: JobSource;
  status: JobStatus;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  retry_count: number;
  created_by: string;
  template_id: string | null;
  group_id?: string | null;
}

export interface JobListItem {
  id: string;
  title: string;
  to: string;
  target_number: string;
  kind: JobKind;
  run_at: string | null;
  cron_expr: string | null;
  enabled: boolean;
  source: JobSource;
  status: JobStatus;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  created_by: string;
  template_id: string | null;
  group_id?: string | null;
  last_error?: string | null;
  retry_count?: number;
}

export interface CreateJobRequest {
  title: string;
  content?: string | null;
  to: string;
  target_number?: string | null;
  kind: JobKind;
  run_at?: string | null;
  cron_expr?: string | null;
  created_by?: string | null;
  template_id?: string | null;
  group_id?: string | null;
}

export interface CreateBatchJobsRequest {
  title: string;
  content?: string | null;
  recipients: string[];
  kind: JobKind;
  run_at?: string | null;
  cron_expr?: string | null;
  created_by?: string | null;
  template_id?: string | null;
}

export interface CreateBatchJobsResponse {
  group_id: string;
  count: number;
  jobs: Job[];
}

export interface GroupActionResponse {
  group_id: string;
  affected: number;
  status: string;
}

export interface RescheduleJobRequest {
  run_at?: string | null;
  cron_expr?: string | null;
}

export interface RunNowResponse {
  status: string;
  job_id: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
}

export interface CreateContactRequest {
  name: string;
  phone: string;
}

export interface UpdateContactRequest {
  name?: string | null;
  phone?: string | null;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
}

export interface CreateTemplateRequest {
  name: string;
  body: string;
}

export interface UpdateTemplateRequest {
  name?: string | null;
  body?: string | null;
}

export interface ApiError {
  status: number;
  detail: string;
}
