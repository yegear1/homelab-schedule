import type { Contact, JobListFilter, JobListItem, JobRun, JobStatus } from '../types';

export type ReadState<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T };
export type AgendaView = 'table' | 'timeline' | 'calendar';
export type AgendaFilters = { status: JobListFilter; from: string; to: string; phone: string; tag: string; query: string; limit: number };
export type AgendaQuery = { status: JobListFilter; from?: string; to?: string; phone?: string; tag?: string; query?: string; limit: number };
export type FilterResult = { ok: true; query: AgendaQuery } | { ok: false; error: string };
export type JobTableRow = { type: 'single'; job: JobListItem } | { type: 'group'; groupId: string; items: JobListItem[] };
export type DayEvents = { jobs: JobListItem[]; runs: JobRun[] };
export const statusLabels: Record<JobStatus, string> = { scheduled: 'Agendado', paused: 'Pausado', done: 'Concluído', error: 'Erro' };

export function defaultFilters(): AgendaFilters {
  return { status: 'upcoming', from: '', to: '', phone: '', tag: '', query: '', limit: 50 };
}
export function parseFilters(filters: AgendaFilters): FilterResult {
  if (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 100) return { ok: false, error: 'O limite deve ser um inteiro entre 1 e 100.' };
  const start = filters.from ? new Date(filters.from).getTime() : null;
  const end = filters.to ? new Date(filters.to).getTime() : null;
  if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end))) return { ok: false, error: 'Informe datas válidas.' };
  if (start !== null && end !== null && start > end) return { ok: false, error: 'O início deve ser anterior ao fim do período.' };
  return { ok: true, query: { status: filters.status, limit: filters.limit,
    from: start === null ? undefined : new Date(start).toISOString(), to: end === null ? undefined : new Date(end).toISOString(),
    phone: filters.phone.trim() || undefined, tag: filters.tag.trim() || undefined, query: filters.query.trim() || undefined } };
}
export function csvFilters(query: AgendaQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'limit' && value !== undefined) params.set(key, String(value));
  }
  return params;
}
export function groupJobs(jobs: JobListItem[]): JobTableRow[] {
  const groups = new Map<string, JobListItem[]>();
  const rows: JobTableRow[] = [];
  for (const job of jobs) {
    if (!job.group_id) { rows.push({ type: 'single', job }); continue; }
    let items = groups.get(job.group_id);
    if (!items) { items = []; groups.set(job.group_id, items); rows.push({ type: 'group', groupId: job.group_id, items }); }
    items.push(job);
  }
  return rows;
}
export function formatDate(iso: string | null | undefined): string {
  return iso && Number.isFinite(new Date(iso).getTime()) ? new Date(iso).toLocaleString('pt-BR') : 'Sem data';
}
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (Math.abs(minutes) < 60) return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(minutes, 'minute');
  if (Math.abs(minutes) < 1440) return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(Math.round(minutes / 60), 'hour');
  return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(Math.round(minutes / 1440), 'day');
}
export function recipientContact(job: JobListItem, contacts: Contact[]): Contact | undefined {
  return contacts.find(contact => contact.phone === (job.target_number || job.to));
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function calendarEvents(jobs: JobListItem[], runs: JobRun[]): Map<string, DayEvents> {
  const events = new Map<string, DayEvents>();
  const add = (iso: string | null, job?: JobListItem, run?: JobRun): void => {
    if (!iso || !Number.isFinite(new Date(iso).getTime())) return;
    const key = dateKey(new Date(iso));
    const day = events.get(key) ?? { jobs: [], runs: [] };
    if (job) day.jobs.push(job);
    if (run) day.runs.push(run);
    events.set(key, day);
  };
  for (const job of jobs) add(job.next_run_at || job.run_at, job);
  for (const run of runs) add(run.ran_at, undefined, run);
  return events;
}
export function saveCsv(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try { link.href = url; link.download = filename; document.body.appendChild(link); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
