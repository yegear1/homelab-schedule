import type { ImportDataRequest } from '../../lib/types';

type RecordValue = Record<string, unknown>;
const _record = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);
const _string = (value: unknown): value is string => typeof value === 'string';
const _number = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);
const _strings = (value: unknown): boolean => Array.isArray(value) && value.every(_string);
const _textMap = (value: unknown): boolean => _record(value) && Object.values(value).every(_string);
const _enum = (...choices: string[]) => (value: unknown): boolean => _string(value) && choices.includes(value);
const _nullable = (check: (value: unknown) => boolean) => (value: unknown): boolean => value === null || check(value);
const _date = (value: unknown): boolean => _string(value) && Number.isFinite(Date.parse(value));
const _optionalJob: Record<string, (value: unknown) => boolean> = {
  id: _nullable(_string), target_number: _string, to: _string, enabled: value => typeof value === 'boolean',
  run_at: _nullable(_date), next_run_at: _nullable(_date), last_run_at: _nullable(_date), until: _nullable(_date),
  cron_expr: _nullable(_string), last_status: _nullable(_string), last_error: _nullable(_string),
  source: _enum('sqlite', 'yaml'), status: _enum('scheduled', 'done', 'paused', 'error'),
  retry_count: Number.isInteger, run_count: Number.isInteger, max_runs: _nullable(Number.isInteger),
  created_by: _string, template_id: _nullable(_string), group_id: _nullable(_string), variables: _textMap, tags: _strings,
};
function _fields(item: RecordValue, fields: Record<string, (value: unknown) => boolean>): boolean {
  return Object.entries(fields).every(([key, check]) => !(key in item) || check(item[key]));
}
function _item(value: unknown, kind: string): boolean {
  if (!_record(value)) return false;
  if (!_fields(value, { id: _nullable(_string) })) return false;
  if (kind === 'contacts') return _string(value.name) && _string(value.phone);
  if (kind === 'templates') return _string(value.name) && _string(value.body);
  if (kind === 'jobs') return _string(value.title) && _string(value.content) && _enum('once', 'cron')(value.kind) && _fields(value, _optionalJob);
  return _string(value.job_id) && _date(value.ran_at) && _enum('schedule', 'manual')(value.trigger)
    && _enum('success', 'error')(value.status) && Number.isInteger(value.status_code) && _number(value.duration_ms)
    && _fields(value, { error_message: _nullable(_string) });
}
function _bundle(value: unknown): value is Omit<ImportDataRequest, 'mode'> {
  if (!_record(value)) return false;
  const keys = ['contacts', 'templates', 'jobs', 'job_runs'];
  return keys.some(key => key in value) && keys.every(key => !(key in value) || (Array.isArray(value[key]) && value[key].every((item: unknown) => _item(item, key))));
}
export function parseImport(text: string): ImportDataRequest {
  const value: unknown = JSON.parse(text);
  if (!_bundle(value)) throw new Error('Formato inválido: verifique as listas e os campos dos registros no JSON.');
  return {
    mode: 'merge', contacts: value.contacts ?? [], templates: value.templates ?? [],
    // The server default recipient is eu when omitted from a portable job.
    jobs: (value.jobs ?? []).map(job => ({ ...job, to: job.to ?? 'eu' })), job_runs: value.job_runs ?? [],
  };
}
