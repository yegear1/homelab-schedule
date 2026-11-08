import type {
  Contact,
  CreateContactRequest,
  UpdateContactRequest,
  MessageTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  Job,
  JobListItem,
  CreateJobRequest,
  CreateBatchJobsRequest,
  CreateBatchJobsResponse,
  GroupActionResponse,
  RescheduleJobRequest,
  SnoozeJobRequest,
  RunNowResponse,
  JobListFilter,
  JobRun,
  JobRunListResponse,
  ExportDataResponse,
  ImportDataRequest,
  ImportDataResponse,
  IntegrityCheckResponse,
  TagsResponse,
  UpcomingRunsResponse,
} from './types';

export class ApiClientError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = detail;
  }
}

function _isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _localizeDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (!Array.isArray(detail)) return '';
  return detail.map((item: unknown) => {
    if (!_isRecord(item) || typeof item.msg !== 'string') return '';
    let msg = item.msg;
    if (msg.includes('Field required')) msg = 'Campo obrigatório';
    else if (msg.includes('String should have at least')) {
      msg = msg.replace('String should have at least', 'Deve ter ao menos')
        .replace('characters', 'caracteres').replace('character', 'caractere');
    } else if (msg.includes('String should have at most')) {
      msg = msg.replace('String should have at most', 'Deve ter no máximo')
        .replace('characters', 'caracteres').replace('character', 'caractere');
    } else if (msg.includes('Input should be a valid string')) msg = 'Formato inválido';
    const location: unknown[] = Array.isArray(item.loc) ? item.loc : [];
    const field = location.length > 1 ? location[location.length - 1] : undefined;
    return typeof field === 'string' || typeof field === 'number' ? `${field}: ${msg}` : msg;
  }).filter(Boolean).join('; ');
}

async function _responseError(response: Response): Promise<ApiClientError> {
  const defaults: Record<number, string> = {
    401: 'Chave x-api-key ausente ou inválida',
    404: 'Recurso não encontrado',
    409: 'Conflito de estado (HTTP 409)',
  };
  let detail = defaults[response.status] || `Erro na requisição (HTTP ${response.status})`;
  try {
    const data: unknown = await response.json();
    if (_isRecord(data)) detail = _localizeDetail(data.detail) || detail;
  } catch {
    // Preserve the HTTP error when the server returns a non-JSON error body.
  }
  return new ApiClientError(response.status, detail);
}

class ApiService {
  private getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      const customUrl = localStorage.getItem('homelab_api_base_url');
      if (customUrl) return customUrl.replace(/\/+$/, '');
    }
    return '';
  }

  getApiKey(): string {
    return typeof window === 'undefined' ? '' : localStorage.getItem('SCHEDULE_API_KEY') || '';
  }

  setApiKey(key: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('SCHEDULE_API_KEY', key);
    }
  }

  setBaseUrl(url: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('homelab_api_base_url', url);
    }
  }

  private async _fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    const key = this.getApiKey();
    if (key) headers.set('x-api-key', key);
    else headers.delete('x-api-key');
    let response: Response;
    try {
      response = await fetch(`${this.getBaseUrl()}${path}`, {
        ...options, headers, cache: 'no-store',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha na conexão de rede';
      throw new ApiClientError(0, `Falha de rede: ${message}`);
    }
    if (!response.ok) throw await _responseError(response);
    return response;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    const response = await this._fetch(path, { ...options, headers });
    if (response.status === 204) return undefined as T;
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new ApiClientError(response.status, `Resposta JSON inválida (HTTP ${response.status})`);
    }
    try {
      const data: unknown = await response.json();
      return data as T;
    } catch {
      throw new ApiClientError(response.status, `Falha ao interpretar resposta JSON (HTTP ${response.status})`);
    }
  }

  // --- Contacts ---
  async getContacts(): Promise<Contact[]> {
    const res = await this.request<{ contacts: Contact[] }>('/contacts');
    return res.contacts;
  }

  async getContact(id: string): Promise<Contact> {
    return this.request<Contact>(`/contacts/${encodeURIComponent(id)}`);
  }

  async createContact(payload: CreateContactRequest): Promise<Contact> {
    return this.request<Contact>('/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async patchContact(id: string, payload: UpdateContactRequest): Promise<Contact> {
    return this.request<Contact>(`/contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteContact(id: string): Promise<void> {
    return this.request<void>(`/contacts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // --- Templates ---
  async getTemplates(): Promise<MessageTemplate[]> {
    const res = await this.request<{ templates: MessageTemplate[] }>('/templates');
    return res.templates;
  }

  async getTemplate(id: string): Promise<MessageTemplate> {
    return this.request<MessageTemplate>(`/templates/${encodeURIComponent(id)}`);
  }

  async createTemplate(payload: CreateTemplateRequest): Promise<MessageTemplate> {
    return this.request<MessageTemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async patchTemplate(id: string, payload: UpdateTemplateRequest): Promise<MessageTemplate> {
    return this.request<MessageTemplate>(`/templates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.request<void>(`/templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // --- Jobs ---
  async getJobs(params?: {
    status?: JobListFilter;
    from?: string;
    to?: string;
    limit?: number;
    phone?: string;
    group_id?: string;
    query?: string;
    tag?: string;
  }): Promise<JobListItem[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.phone) query.set('phone', params.phone);
    if (params?.group_id) query.set('group_id', params.group_id);
    if (params?.query) query.set('query', params.query);
    if (params?.tag) query.set('tag', params.tag);

    const q = query.toString();
    const res = await this.request<{ jobs: JobListItem[] }>(`/jobs${q ? `?${q}` : ''}`);
    return res.jobs;
  }

  async getTags(): Promise<string[]> {
    const res = await this.request<TagsResponse>('/jobs/tags');
    return res.tags;
  }

  async getJob(id: string): Promise<Job> {
    return this.request<Job>(`/jobs/${encodeURIComponent(id)}`);
  }

  async createJob(payload: CreateJobRequest): Promise<Job> {
    return this.request<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createBatchJobs(payload: CreateBatchJobsRequest): Promise<CreateBatchJobsResponse> {
    return this.request<CreateBatchJobsResponse>('/jobs/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancelJob(id: string): Promise<void> {
    return this.request<void>(`/jobs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
  }

  async pauseJob(id: string): Promise<Job> {
    return this.request<Job>(`/jobs/${encodeURIComponent(id)}/pause`, {
      method: 'POST',
    });
  }

  async resumeJob(id: string): Promise<Job> {
    return this.request<Job>(`/jobs/${encodeURIComponent(id)}/resume`, {
      method: 'POST',
    });
  }

  async snoozeJob(id: string, payload: SnoozeJobRequest): Promise<Job> {
    return this.request<Job>(`/jobs/${encodeURIComponent(id)}/snooze`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancelGroup(groupId: string): Promise<GroupActionResponse> {
    return this.request<GroupActionResponse>(`/jobs/group/${encodeURIComponent(groupId)}/cancel`, {
      method: 'POST',
    });
  }

  async pauseGroup(groupId: string): Promise<GroupActionResponse> {
    return this.request<GroupActionResponse>(`/jobs/group/${encodeURIComponent(groupId)}/pause`, {
      method: 'POST',
    });
  }

  async resumeGroup(groupId: string): Promise<GroupActionResponse> {
    return this.request<GroupActionResponse>(`/jobs/group/${encodeURIComponent(groupId)}/resume`, {
      method: 'POST',
    });
  }

  async snoozeGroup(groupId: string, payload: SnoozeJobRequest): Promise<GroupActionResponse> {
    return this.request<GroupActionResponse>(`/jobs/group/${encodeURIComponent(groupId)}/snooze`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async rescheduleJob(id: string, payload: RescheduleJobRequest): Promise<Job> {
    return this.request<Job>(`/jobs/${encodeURIComponent(id)}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async runJob(id: string): Promise<RunNowResponse> {
    return this.request<RunNowResponse>(`/jobs/${encodeURIComponent(id)}/run`, {
      method: 'POST',
    });
  }

  async retryJob(id: string): Promise<Job> {
    return this.request<Job>(`/jobs/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
    });
  }

  async runGroup(groupId: string): Promise<GroupActionResponse> {
    return this.request<GroupActionResponse>(`/jobs/group/${encodeURIComponent(groupId)}/run`, {
      method: 'POST',
    });
  }

  async retryGroup(groupId: string): Promise<GroupActionResponse> {
    return this.request<GroupActionResponse>(`/jobs/group/${encodeURIComponent(groupId)}/retry`, {
      method: 'POST',
    });
  }

  async getJobRuns(id: string, limit: number = 50): Promise<JobRun[]> {
    const res = await this.request<JobRunListResponse>(
      `/jobs/${encodeURIComponent(id)}/runs?limit=${limit}`
    );
    return res.runs;
  }

  async getUpcomingRuns(id: string, limit: number = 5): Promise<UpcomingRunsResponse> {
    return this.request<UpcomingRunsResponse>(
      `/jobs/${encodeURIComponent(id)}/upcoming?limit=${limit}`
    );
  }


  async getAllJobRuns(limit: number = 50, status?: string): Promise<JobRun[]> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (status) params.set('status', status);
    const res = await this.request<JobRunListResponse>(`/jobs/runs?${params.toString()}`);
    return res.runs;
  }

  async downloadDatabase(): Promise<Blob> {
    const response = await this._fetch('/backup/database', {
      headers: { Accept: 'application/x-sqlite3' },
    });
    if (!response.headers.get('content-type')?.includes('application/x-sqlite3')) {
      throw new ApiClientError(response.status, 'Resposta SQLite inválida');
    }
    return response.blob();
  }

  async downloadCsv(path: '/jobs/export.csv' | '/jobs/runs/export.csv', params: URLSearchParams): Promise<Blob> {
    const response = await this._fetch(`${path}?${params}`, { headers: { Accept: 'text/csv' } });
    if (!response.headers.get('content-type')?.includes('text/csv')) {
      throw new ApiClientError(response.status, 'Resposta CSV inválida');
    }
    return response.blob();
  }

  async exportData(includeRuns: boolean = true): Promise<ExportDataResponse> {
    return this.request<ExportDataResponse>(`/backup/export?include_runs=${includeRuns}`);
  }

  async importData(payload: ImportDataRequest): Promise<ImportDataResponse> {
    return this.request<ImportDataResponse>('/backup/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async checkIntegrity(): Promise<IntegrityCheckResponse> {
    return this.request<IntegrityCheckResponse>('/backup/integrity');
  }
}

export const api = new ApiService();
