import { api, ApiClientError } from '../api';
import type { Contact, JobListItem, JobRun } from '../types';
import { type AgendaQuery, type ReadState } from './agenda';

export class AgendaState {
  jobs = $state<ReadState<JobListItem[]>>({ status: 'loading' });
  runs = $state<ReadState<JobRun[]>>({ status: 'loading' });
  contacts = $state<Contact[]>([]);
  tags = $state<string[]>([]);
  catalogError = $state('');
  revision = $state(0);
  applied = $state<AgendaQuery>({ status: 'upcoming', limit: 50 });
  private _jobsGeneration = 0;
  private _runsGeneration = 0;
  private _catalogGeneration = 0;

  async loadJobs(query: AgendaQuery = this.applied): Promise<void> {
    const request = ++this._jobsGeneration;
    this.applied = { ...query };
    this.jobs = { status: 'loading' };
    try {
      const data = await api.getJobs(query);
      if (request === this._jobsGeneration) { this.jobs = { status: 'ready', data }; this.revision++; }
    } catch (err) { if (request === this._jobsGeneration) this.jobs = { status: 'error', error: this._error(err) }; }
  }
  async loadRuns(): Promise<void> {
    const request = ++this._runsGeneration;
    this.runs = { status: 'loading' };
    try {
      const data = await api.getAllJobRuns(100);
      if (request === this._runsGeneration) this.runs = { status: 'ready', data };
    } catch (err) { if (request === this._runsGeneration) this.runs = { status: 'error', error: this._error(err) }; }
  }
  async loadCatalogs(): Promise<void> {
    const request = ++this._catalogGeneration;
    this.catalogError = '';
    const results = await Promise.allSettled([api.getContacts(), api.getTags()]);
    if (request !== this._catalogGeneration) return;
    if (results[0].status === 'fulfilled') this.contacts = results[0].value;
    if (results[1].status === 'fulfilled') this.tags = results[1].value;
    if (results.some(result => result.status === 'rejected')) this.catalogError = 'Falha ao atualizar nomes de contatos ou sugestões de tags. Os filtros manuais continuam disponíveis.';
  }
  async refresh(): Promise<void> { await Promise.all([this.loadJobs(), this.loadRuns()]); }
  dispose(): void { this._jobsGeneration++; this._runsGeneration++; this._catalogGeneration++; }
  private _error(err: unknown): string {
    return err instanceof ApiClientError && err.status === 401 ? 'Chave x-api-key ausente ou inválida. Configure o acesso e tente novamente.' : err instanceof Error ? err.message : 'Falha ao carregar dados.';
  }
}
