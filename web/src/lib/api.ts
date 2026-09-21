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
  IntegrityCheckResponse
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

function localizeDetail(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item: { msg?: string; loc?: (string | number)[] }) => {
        let msg = item.msg || '';
        if (msg.includes('Field required')) msg = 'Campo obrigatório';
        else if (msg.includes('String should have at least')) {
          msg = msg
            .replace('String should have at least', 'Deve ter ao menos')
            .replace('characters', 'caracteres')
            .replace('character', 'caractere');
        } else if (msg.includes('String should have at most')) {
          msg = msg
            .replace('String should have at most', 'Deve ter no máximo')
            .replace('characters', 'caracteres')
            .replace('character', 'caractere');
        } else if (msg.includes('Input should be a valid string')) {
          msg = 'Formato inválido';
        }
        const field = item.loc && item.loc.length > 1 ? String(item.loc[item.loc.length - 1]) : '';
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join('; ');
  }
  return '';
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
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('SCHEDULE_API_KEY');
      if (stored) return stored;
      return 'hl_prod_1a0bd02e18703c25d6fb5694ccbb520698741f574e3ba4de';
    }
    return 'hl_prod_1a0bd02e18703c25d6fb5694ccbb520698741f574e3ba4de';
  }

  setApiKey(key: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('SCHEDULE_API_KEY', key);
    }
  }

  setBaseUrl(url: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('homelab_api_base_url', url);
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${path}`;
    const apiKey = this.getApiKey();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        cache: 'no-store',
        ...options,
        headers,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na conexão de rede';
      throw new ApiClientError(0, `Falha de rede: ${msg}`);
    }

    if (!response.ok) {
      let detail = `Erro na requisição (HTTP ${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          const localized = localizeDetail(errorData.detail);
          if (localized) detail = localized;
        }
      } catch {
        // Response wasn't JSON
      }

      if (response.status === 401) {
        detail = detail || 'Chave x-api-key ausente ou inválida';
      } else if (response.status === 404) {
        detail = detail || 'Recurso não encontrado';
      } else if (response.status === 409) {
        detail = detail || 'Conflito de estado (HTTP 409)';
      }
      throw new ApiClientError(response.status, detail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new ApiClientError(
        response.status,
        `Resposta inesperada do servidor (HTTP ${response.status}): ${text.slice(0, 100)}`
      );
    }

    try {
      return (await response.json()) as T;
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
  }): Promise<JobListItem[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.phone) query.set('phone', params.phone);
    if (params?.group_id) query.set('group_id', params.group_id);

    const q = query.toString();
    const res = await this.request<{ jobs: JobListItem[] }>(`/jobs${q ? `?${q}` : ''}`);
    return res.jobs;
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

  async getAllJobRuns(limit: number = 50, status?: string): Promise<JobRun[]> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (status) params.set('status', status);
    const res = await this.request<JobRunListResponse>(`/jobs/runs?${params.toString()}`);
    return res.runs;
  }

  async downloadDatabase(): Promise<Blob> {
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    const response = await fetch(`${baseUrl}/backup/database`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text();
      let detail = `Download falhou (${response.status})`;
      try {
        const json = JSON.parse(text);
        if (json.detail) detail = localizeDetail(json.detail);
      } catch {
        // use default detail
      }
      throw new ApiClientError(response.status, detail);
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
