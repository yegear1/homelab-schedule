/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { UploadCloud } from 'lucide-react';
import { api } from '../../lib/api';
import type { ImportDataRequest, ImportDataResponse, ImportMode } from '../../lib/types';
import { useJobsStore } from '../../stores/jobs';

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
  id: _nullable(_string),
  target_number: _string,
  to: _string,
  enabled: (value: unknown) => typeof value === 'boolean',
  run_at: _nullable(_date),
  next_run_at: _nullable(_date),
  last_run_at: _nullable(_date),
  until: _nullable(_date),
  cron_expr: _nullable(_string),
  last_status: _nullable(_string),
  last_error: _nullable(_string),
  source: _enum('sqlite', 'yaml'),
  status: _enum('scheduled', 'done', 'paused', 'error'),
  retry_count: Number.isInteger,
  run_count: Number.isInteger,
  max_runs: _nullable(Number.isInteger),
  created_by: _string,
  template_id: _nullable(_string),
  group_id: _nullable(_string),
  variables: _textMap,
  tags: _strings,
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
  return keys.some((key) => key in value) && keys.every((key) => !(key in value) || (Array.isArray(value[key]) && value[key].every((item: unknown) => _item(item, key))));
}

export function parseImport(text: string): Omit<ImportDataRequest, 'mode'> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('JSON inválido: verifique a sintaxe do arquivo.');
  }
  if (!_bundle(value)) {
    throw new Error('Formato inválido: verifique as listas e os campos dos registros no JSON.');
  }
  const rawJobs = (value.jobs as RecordValue[] | undefined) ?? [];
  return {
    contacts: (value.contacts as ImportDataRequest['contacts']) ?? [],
    templates: (value.templates as ImportDataRequest['templates']) ?? [],
    jobs: rawJobs.map((job) => ({ ...job, to: (job.to as string) ?? 'eu' })) as ImportDataRequest['jobs'],
    job_runs: (value.job_runs as ImportDataRequest['job_runs']) ?? [],
  };
}

export function BackupImportCard() {
  const { fetchJobs, fetchContacts, fetchTemplates } = useJobsStore();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [payload, setPayload] = useState<Omit<ImportDataRequest, 'mode'> | null>(null);
  const [result, setResult] = useState<ImportDataResponse | null>(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const executeBtnRef = useRef<HTMLButtonElement>(null);
  const generationRef = useRef(0);

  const _file = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const request = ++generationRef.current;
    setPayload(null);
    setResult(null);
    setError('');
    setConfirming(false);

    const file = event.target.files?.[0];
    if (!file) {
      setReading(false);
      return;
    }

    setReading(true);
    try {
      const text = await file.text();
      const parsed = parseImport(text);
      if (request === generationRef.current) {
        setPayload(parsed);
      }
    } catch (err: unknown) {
      if (request === generationRef.current) {
        setError(err instanceof Error ? err.message : 'Falha ao ler arquivo.');
      }
    } finally {
      if (request === generationRef.current) {
        setReading(false);
      }
    }
  };

  const _execute = async () => {
    if (!payload || busy) return;
    setBusy(true);
    setError('');
    setResult(null);

    try {
      const res = await api.importData({ ...payload, mode });
      setResult(res);
      setPayload(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setConfirming(false);
      await Promise.all([fetchJobs(), fetchContacts(), fetchTemplates()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao importar dados.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCloseDialog = () => {
    if (!busy) {
      setConfirming(false);
      executeBtnRef.current?.focus();
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-sky-500" />
          <h2 id="import-title" className="text-base font-semibold text-foreground">
            Importar JSON
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Confira os registros antes de importar. Rotinas YAML são mantidas.
        </p>
      </div>

      <fieldset disabled={busy} className="grid gap-4 min-w-0">
        <legend className="text-xs font-medium text-muted-foreground mb-1">
          Estratégia de importação
        </legend>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-center gap-2 min-h-11 cursor-pointer">
            <input
              type="radio"
              name="importMode"
              value="merge"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
              disabled={busy}
              className="h-4 w-4 text-sky-500 focus:ring-sky-500"
            />
            <span className="text-xs text-foreground font-medium">
              Mesclar — atualizar ou inserir
            </span>
          </label>
          <label className="flex items-center gap-2 min-h-11 cursor-pointer">
            <input
              type="radio"
              name="importMode"
              value="replace"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
              disabled={busy}
              className="h-4 w-4 text-rose-500 focus:ring-rose-500"
            />
            <span className="text-xs text-foreground font-medium">
              Substituir — apagar dados SQLite anteriores
            </span>
          </label>
        </div>

        <div className="space-y-1">
          <label htmlFor="input-import-file" className="block text-xs font-medium text-foreground">
            Selecionar arquivo JSON
          </label>
          <input
            ref={fileInputRef}
            id="input-import-file"
            type="file"
            accept=".json,application/json"
            onChange={_file}
            disabled={busy}
            className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500 file:text-white hover:file:bg-sky-600 file:cursor-pointer disabled:opacity-50"
          />
        </div>
      </fieldset>

      {reading && <p role="status" className="text-xs text-muted-foreground">Lendo arquivo…</p>}

      {error && (
        <p role="alert" className="text-xs text-rose-500 font-medium break-words">
          {error}
        </p>
      )}

      {payload && (
        <div className="space-y-4">
          <div aria-label="Resumo do arquivo" className="grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums bg-sky-500/10 border border-sky-500/20 p-4 rounded-lg text-xs font-mono">
            <p>Contatos: <strong>{payload.contacts?.length ?? 0}</strong></p>
            <p>Modelos: <strong>{payload.templates?.length ?? 0}</strong></p>
            <p>Agendamentos: <strong>{payload.jobs?.length ?? 0}</strong></p>
            <p>Execuções: <strong>{payload.job_runs?.length ?? 0}</strong></p>
          </div>

          <button
            type="button"
            id="btn-execute-import"
            ref={executeBtnRef}
            disabled={busy || reading}
            onClick={() => {
              if (mode === 'replace') {
                setConfirming(true);
              } else {
                void _execute();
              }
            }}
            className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg text-white transition-colors min-h-[44px] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${
              mode === 'replace' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-sky-500 hover:bg-sky-600'
            }`}
          >
            <span>
              {busy ? 'Importando…' : mode === 'replace' ? 'Revisar substituição (Importar JSON)' : 'Processar importação (Importar JSON)'}
            </span>
          </button>
        </div>
      )}

      {result && (
        <div role="status" id="import-result" className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 space-y-2 text-xs">
          <h3 className="font-semibold text-emerald-500">Importação concluída</h3>
          <p className="text-muted-foreground text-[11px]">
            As listas serão atualizadas ao abrir Agenda, Contatos, Modelos ou Histórico.
          </p>
          <div className="space-y-1 font-mono text-[11px] text-foreground">
            <p>Contatos: {result.summary?.contacts?.created ?? 0} criados, {result.summary?.contacts?.updated ?? 0} atualizados, {result.summary?.contacts?.skipped ?? 0} ignorados.</p>
            <p>Modelos: {result.summary?.templates?.created ?? 0} criados, {result.summary?.templates?.updated ?? 0} atualizados, {result.summary?.templates?.skipped ?? 0} ignorados.</p>
            <p>Agendamentos: {result.summary?.jobs?.created ?? 0} criados, {result.summary?.jobs?.updated ?? 0} atualizados, {result.summary?.jobs?.skipped ?? 0} ignorados.</p>
            <p>Execuções: {result.summary?.job_runs?.created ?? 0} criados, {result.summary?.job_runs?.updated ?? 0} atualizados, {result.summary?.job_runs?.skipped ?? 0} ignorados.</p>
          </div>
          {result.warnings && result.warnings.length > 0 && (
            <div className="pt-2 border-t border-border">
              <h3 className="font-semibold text-amber-500">Avisos</h3>
              <ul className="text-muted-foreground text-[11px] list-disc list-inside">
                {result.warnings.map((w, idx) => (
                  <li key={idx} className="break-words">{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Double-confirmation dialog for Replace mode */}
      <Dialog.Root open={confirming} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" />
          <Dialog.Content
            id="replace-confirm"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              executeBtnRef.current?.focus();
            }}
            onEscapeKeyDown={(e) => {
              if (!busy) {
                e.preventDefault();
                handleCloseDialog();
              }
            }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border bg-card p-6 shadow-xl rounded-xl text-foreground focus:outline-none"
          >
            <Dialog.Title className="text-sm font-semibold text-rose-500">
              Confirmar substituição
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Os dados SQLite anteriores serão apagados. Rotinas YAML são mantidas. Deseja continuar?
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleCloseDialog}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancelar substituição
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void _execute()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Importando…' : 'Confirmar substituição'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
