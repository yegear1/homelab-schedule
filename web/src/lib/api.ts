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
  RunNowResponse,
  JobListFilter
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
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    let response: Response;
    try {
      response = await fetch(url, {
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
        if (errorData && typeof errorData.detail === 'string') {
          detail = errorData.detail;
        } else if (errorData && Array.isArray(errorData.detail)) {
          detail = errorData.detail.map((d: { msg?: string }) => d.msg || '').filter(Boolean).join('; ');
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

    return (await response.json()) as T;
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

  async cancelGroup(groupId: string): Promise<GroupActionResponse> {
    return this.request<GroupActionResponse>(`/jobs/group/${encodeURIComponent(groupId)}/cancel`, {
      method: 'POST',
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

  async runGroup(groupId: string): Promise<GroupActionResponse> {
    return this.request<GroupActionResponse>(`/jobs/group/${encodeURIComponent(groupId)}/run`, {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
