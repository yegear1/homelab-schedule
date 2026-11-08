import type { CreateJobRequest, JobKind } from '../types';

export interface JobDraft {
  title: string;
  kind: JobKind;
  runAt: string;
  cronExpr: string;
  recipients: string[];
  recipientInput: string;
  createdBy: string;
  payloadMode: 'direct' | 'template';
  content: string;
  templateId: string;
  until: string;
  maxRuns: number | undefined;
  variables: { key: string; value: string }[];
  tags: string[];
}
export type ComposerPayload = { common: Omit<CreateJobRequest, 'to'>; recipients: string[] };
export type DraftResult = { ok: true; payload: ComposerPayload } | { ok: false; error: string };

export function newDraft(recipient = 'eu', createdBy = ''): JobDraft {
  return { title: '', kind: 'once', runAt: '', cronExpr: '', recipients: [recipient],
    recipientInput: '', createdBy, payloadMode: 'direct', content: '', templateId: '',
    until: '', maxRuns: undefined, variables: [], tags: [] };
}

export function splitRecipients(values: string[], input: string): string[] {
  return [...new Set([...values, ...input.split(/[,;\s]+/)].map((v) => v.trim()).filter(Boolean))];
}

function _iso(value: string): string | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function buildPayload(draft: JobDraft): DraftResult {
  const recipients = splitRecipients(draft.recipients, draft.recipientInput);
  const runAt = draft.kind === 'once' ? _iso(draft.runAt) : null;
  const until = draft.until ? _iso(draft.until) : null;
  const content = draft.payloadMode === 'direct' ? draft.content.trim() : null;
  const templateId = draft.payloadMode === 'template' ? draft.templateId.trim() : null;
  let error = '';
  if (!draft.title.trim() || draft.title.trim().length > 120) error = 'Informe um título de até 120 caracteres.';
  else if (!recipients.length) error = 'Adicione ao menos um destinatário.';
  else if (draft.kind === 'once' && !runAt) error = 'Informe uma data e hora válidas.';
  else if (draft.kind === 'cron' && draft.cronExpr.trim().split(/\s+/).length !== 5) error = 'A expressão cron precisa de cinco campos.';
  else if (!content && !templateId) error = 'Escreva a mensagem ou selecione um modelo.';
  else if (draft.until && !until) error = 'Informe uma data limite válida.';
  else if (runAt && until && runAt > until) error = 'A execução deve ocorrer até a data limite.';
  else if (draft.maxRuns !== undefined && (!Number.isInteger(draft.maxRuns) || draft.maxRuns <= 0)) error = 'O máximo de execuções deve ser um inteiro positivo.';
  if (error) return { ok: false, error };
  return { ok: true, payload: { recipients, common: {
    title: draft.title.trim(), kind: draft.kind, run_at: runAt,
    cron_expr: draft.kind === 'cron' ? draft.cronExpr.trim() : null,
    content, template_id: templateId, created_by: draft.createdBy.trim() || null,
    until, max_runs: draft.maxRuns ?? null,
    variables: draft.variables.length ? Object.fromEntries(draft.variables.map((v): [string, string] => [v.key, v.value])) : undefined,
    tags: draft.tags.length ? draft.tags : undefined,
  } } };
}
