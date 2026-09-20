export type JobKind = 'once' | 'cron';
export type JobSource = 'sqlite' | 'yaml';
export type JobStatus = 'scheduled' | 'done' | 'paused' | 'error';
export type JobListFilter = 'upcoming' | 'done' | 'paused' | 'error' | 'all';
export type JobRunTrigger = 'schedule' | 'manual';
export type JobRunStatus = 'success' | 'error';

export interface JobRun {
  id: string;
  job_id: string;
  ran_at: string;
  trigger: JobRunTrigger;
  status: JobRunStatus;
  status_code: number;
  duration_ms: number;
  error_message: string | null;
}

export interface JobRunListResponse {
  runs: JobRun[];
}

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
  variables?: Record<string, string>;
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
  variables?: Record<string, string>;
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
  variables?: Record<string, string>;
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
  variables?: Record<string, string>;
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

export type ImportMode = 'merge' | 'replace';

export interface ExportMetadata {
  version: number;
  schema_version: number;
  exported_at: string;
  counts: Record<string, number>;
}

export interface ExportDataResponse {
  metadata: ExportMetadata;
  contacts: Contact[];
  templates: MessageTemplate[];
  jobs: Job[];
  job_runs: JobRun[];
}

export interface ImportCounts {
  created: number;
  updated: number;
  skipped: number;
}

export interface ImportSummary {
  contacts: ImportCounts;
  templates: ImportCounts;
  jobs: ImportCounts;
  job_runs: ImportCounts;
}

export interface ImportDataRequest {
  mode: ImportMode;
  contacts?: Array<{ id?: string; name: string; phone: string }>;
  templates?: Array<{ id?: string; name: string; body: string }>;
  jobs?: Array<Partial<Job> & { title: string; content: string; to: string; kind: JobKind }>;
  job_runs?: Array<Partial<JobRun> & { job_id: string; ran_at: string }>;
}

export interface ImportDataResponse {
  status: string;
  mode: ImportMode;
  summary: ImportSummary;
  warnings: string[];
}

export interface FkViolation {
  table: string;
  rowid: number;
  parent: string;
  fkid: number;
}

export interface IntegrityCheckResponse {
  integrity_ok: boolean;
  details: string[];
  foreign_keys_ok: boolean;
  fk_violations: FkViolation[];
}
