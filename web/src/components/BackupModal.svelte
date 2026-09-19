<script lang="ts">
  import { api } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { focusTrap } from '../lib/focusTrap';
  import type { ExportDataResponse, ImportDataRequest, IntegrityCheckResponse } from '../lib/types';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let activeTab = $state<'backup' | 'export' | 'import' | 'integrity'>('backup');
  let includeRunsInExport = $state(true);
  let isExporting = $state(false);
  let isDownloadingDb = $state(false);

  // Import states
  let importMode = $state<'merge' | 'replace'>('merge');
  let importFile = $state<File | null>(null);
  let importPreview = $state<{
    contacts: number;
    templates: number;
    jobs: number;
    job_runs: number;
    payload: ImportDataRequest | null;
  } | null>(null);
  let isImporting = $state(false);
  let showReplaceConfirm = $state(false);

  // Integrity check states
  let isCheckingIntegrity = $state(false);
  let integrityResult = $state<IntegrityCheckResponse | null>(null);

  $effect(() => {
    if (open) {
      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onclose();
      };
      window.addEventListener('keydown', handleKeydown);
      return () => window.removeEventListener('keydown', handleKeydown);
    }
  });

  async function handleDownloadDatabase() {
    isDownloadingDb = true;
    try {
      const blob = await api.downloadDatabase();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `homelab-schedule-backup-${timestamp}.sqlite3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Backup do SQLite (.sqlite3) baixado com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao baixar backup';
      toast.error(msg);
    } finally {
      isDownloadingDb = false;
    }
  }

  async function handleExportJson() {
    isExporting = true;
    try {
      const data: ExportDataResponse = await api.exportData(includeRunsInExport);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `homelab-schedule-export-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Exportação JSON concluída (${data.metadata.counts.jobs} jobs, ${data.metadata.counts.contacts} contatos).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao exportar dados';
      toast.error(msg);
    } finally {
      isExporting = false;
    }
  }

  async function handleFileSelected(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) {
      importFile = null;
      importPreview = null;
      return;
    }

    const file = target.files[0];
    importFile = file;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const contacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
      const templates = Array.isArray(parsed.templates) ? parsed.templates : [];
      const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
      const job_runs = Array.isArray(parsed.job_runs) ? parsed.job_runs : [];

      importPreview = {
        contacts: contacts.length,
        templates: templates.length,
        jobs: jobs.length,
        job_runs: job_runs.length,
        payload: {
          mode: importMode,
          contacts,
          templates,
          jobs,
          job_runs,
        },
      };
    } catch (err) {
      toast.error('Arquivo JSON inválido ou corrompido.');
      importFile = null;
      importPreview = null;
    }
  }

  async function executeImport() {
    if (!importPreview || !importPreview.payload) return;
    isImporting = true;
    try {
      const payload: ImportDataRequest = {
        ...importPreview.payload,
        mode: importMode,
      };
      const res = await api.importData(payload);
      const summary = res.summary;
      const totalCreated = summary.contacts.created + summary.templates.created + summary.jobs.created + summary.job_runs.created;
      const totalUpdated = summary.contacts.updated + summary.templates.updated + summary.jobs.updated + summary.job_runs.updated;
      toast.success(`Importação realizada! Criados: ${totalCreated}, Atualizados: ${totalUpdated}`);
      if (res.warnings && res.warnings.length > 0) {
        toast.info(`Avisos: ${res.warnings.join('; ')}`);
      }
      importFile = null;
      importPreview = null;
      showReplaceConfirm = false;
      onclose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na importação dos dados';
      toast.error(msg);
    } finally {
      isImporting = false;
    }
  }

  async function handleCheckIntegrity() {
    isCheckingIntegrity = true;
    try {
      integrityResult = await api.checkIntegrity();
      if (integrityResult.integrity_ok && integrityResult.foreign_keys_ok) {
        toast.success('Auditoria de integridade concluída: banco íntegro!');
      } else {
        toast.error('Foram detectadas inconsistências no banco de dados.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na checagem de integridade';
      toast.error(msg);
    } finally {
      isCheckingIntegrity = false;
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-space-md cursor-pointer"
    onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
    role="presentation"
  >
    <div
      use:focusTrap
      class="bg-surface-container-low max-w-xl w-full rounded p-space-lg shadow-xl flex flex-col gap-space-md border border-outline-variant/30 cursor-default"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- HEADER -->
      <div class="flex items-center justify-between pb-space-xs border-b border-outline-variant/10">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-primary text-[22px]">database</span>
          <h3 class="font-headline-sm text-headline-sm text-on-surface">Backup & Dados SQLite</h3>
        </div>
        <button
          class="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container"
          onclick={onclose}
          type="button"
          aria-label="Fechar"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- TABS -->
      <div class="flex border-b border-outline-variant/20 gap-space-xs">
        <button
          type="button"
          class="px-space-md py-space-xs font-label-ui text-label-ui border-b-2 transition-colors {activeTab === 'backup' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}"
          onclick={() => (activeTab = 'backup')}
        >
          Snapshot Físico
        </button>
        <button
          type="button"
          class="px-space-md py-space-xs font-label-ui text-label-ui border-b-2 transition-colors {activeTab === 'export' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}"
          onclick={() => (activeTab = 'export')}
        >
          Exportar JSON
        </button>
        <button
          type="button"
          class="px-space-md py-space-xs font-label-ui text-label-ui border-b-2 transition-colors {activeTab === 'import' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}"
          onclick={() => (activeTab = 'import')}
        >
          Importar JSON
        </button>
        <button
          type="button"
          class="px-space-md py-space-xs font-label-ui text-label-ui border-b-2 transition-colors {activeTab === 'integrity' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}"
          onclick={() => (activeTab = 'integrity')}
        >
          Integridade
        </button>
      </div>

      <!-- TAB 1: SNAPSHOT FÍSICO -->
      {#if activeTab === 'backup'}
        <div class="flex flex-col gap-space-md py-space-xs">
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Gera uma cópia binária consistente e atômica (<code class="font-label-code text-tertiary">.sqlite3</code>) da base de dados ativa em modo WAL utilizando a API nativa de backup do SQLite.
          </p>
          <div class="bg-surface-container p-space-md rounded flex items-center justify-between">
            <div class="flex items-center gap-space-sm">
              <span class="material-symbols-outlined text-tertiary text-[28px]">save</span>
              <div class="flex flex-col">
                <span class="font-headline-sm text-on-surface">Base SQLite Primária</span>
                <span class="font-label-code-sm text-on-surface-variant">Modo WAL, chaves estrangeiras ativas</span>
              </div>
            </div>
            <button
              id="btn-download-sqlite"
              type="button"
              class="px-space-md py-space-sm bg-primary text-on-primary rounded font-label-ui text-label-ui flex items-center gap-space-xs hover:opacity-90 transition-opacity disabled:opacity-50"
              onclick={handleDownloadDatabase}
              disabled={isDownloadingDb}
            >
              <span class="material-symbols-outlined text-[18px]">download</span>
              {isDownloadingDb ? 'Gerando...' : 'Baixar .sqlite3'}
            </button>
          </div>
        </div>
      {/if}

      <!-- TAB 2: EXPORTAR JSON -->
      {#if activeTab === 'export'}
        <div class="flex flex-col gap-space-md py-space-xs">
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Exporta todos os contatos, modelos, agendamentos SQLite e histórico para um arquivo JSON portável e legível.
          </p>

          <label class="flex items-center gap-space-sm cursor-pointer select-none">
            <input
              type="checkbox"
              bind:checked={includeRunsInExport}
              class="rounded border-outline-variant/30 text-primary focus:ring-primary"
            />
            <span class="font-body-sm text-on-surface">Incluir histórico de disparos e execuções (<code class="font-label-code text-tertiary">job_runs</code>)</span>
          </label>

          <div class="flex justify-end pt-space-sm">
            <button
              id="btn-export-json"
              type="button"
              class="px-space-md py-space-sm bg-primary text-on-primary rounded font-label-ui text-label-ui flex items-center gap-space-xs hover:opacity-90 transition-opacity disabled:opacity-50"
              onclick={handleExportJson}
              disabled={isExporting}
            >
              <span class="material-symbols-outlined text-[18px]">file_download</span>
              {isExporting ? 'Exportando...' : 'Exportar Arquivo JSON'}
            </button>
          </div>
        </div>
      {/if}

      <!-- TAB 3: IMPORTAR JSON -->
      {#if activeTab === 'import'}
        <div class="flex flex-col gap-space-md py-space-xs">
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Carrega contatos, templates e agendamentos a partir de um arquivo JSON sob transação atômica.
          </p>

          <!-- Mode Selection -->
          <div class="flex flex-col gap-space-xs">
            <span class="font-label-ui text-label-ui uppercase text-on-surface-variant">Estratégia de Importação</span>
            <div class="grid grid-cols-2 gap-space-sm">
              <label class="flex items-start gap-space-xs p-space-sm rounded border cursor-pointer {importMode === 'merge' ? 'border-primary bg-primary/10' : 'border-outline-variant/20 hover:bg-surface-container'}">
                <input type="radio" name="importMode" value="merge" bind:group={importMode} class="mt-1" />
                <div class="flex flex-col">
                  <span class="font-label-ui font-bold text-on-surface">Mesclar (Merge)</span>
                  <span class="font-body-sm text-on-surface-variant text-[11px]">Atualiza ou insere novos registros sem apagar os existentes.</span>
                </div>
              </label>
              <label class="flex items-start gap-space-xs p-space-sm rounded border cursor-pointer {importMode === 'replace' ? 'border-error bg-error/10' : 'border-outline-variant/20 hover:bg-surface-container'}">
                <input type="radio" name="importMode" value="replace" bind:group={importMode} class="mt-1" />
                <div class="flex flex-col">
                  <span class="font-label-ui font-bold text-on-surface">Substituir (Replace)</span>
                  <span class="font-body-sm text-on-surface-variant text-[11px]">Limpa dados do SQLite e recarrega. Rotinas YAML são mantidas.</span>
                </div>
              </label>
            </div>
          </div>

          <!-- File Picker -->
          <div class="flex flex-col gap-1">
            <label class="font-label-ui text-label-ui uppercase text-on-surface-variant" for="input-import-file">
              Selecionar Arquivo JSON
            </label>
            <input
              id="input-import-file"
              type="file"
              accept=".json,application/json"
              class="bg-surface-container-lowest text-on-surface rounded p-space-sm font-label-code text-label-code border border-outline-variant/20 cursor-pointer"
              onchange={handleFileSelected}
            />
          </div>

          <!-- Preview -->
          {#if importPreview}
            <div class="bg-surface-container p-space-md rounded flex flex-col gap-space-xs">
              <span class="font-label-ui text-label-ui font-bold text-on-surface">Resumo do Arquivo</span>
              <div class="grid grid-cols-4 gap-space-xs text-center font-label-code-sm">
                <div class="bg-surface-container-lowest p-space-xs rounded">
                  <span class="text-primary font-bold">{importPreview.contacts}</span>
                  <span class="block text-on-surface-variant text-[10px]">Contatos</span>
                </div>
                <div class="bg-surface-container-lowest p-space-xs rounded">
                  <span class="text-primary font-bold">{importPreview.templates}</span>
                  <span class="block text-on-surface-variant text-[10px]">Modelos</span>
                </div>
                <div class="bg-surface-container-lowest p-space-xs rounded">
                  <span class="text-primary font-bold">{importPreview.jobs}</span>
                  <span class="block text-on-surface-variant text-[10px]">Agendas</span>
                </div>
                <div class="bg-surface-container-lowest p-space-xs rounded">
                  <span class="text-primary font-bold">{importPreview.job_runs}</span>
                  <span class="block text-on-surface-variant text-[10px]">Execuções</span>
                </div>
              </div>
            </div>

            {#if importMode === 'replace' && !showReplaceConfirm}
              <div class="bg-error/10 border border-error/30 p-space-sm rounded flex items-center justify-between text-error font-body-sm">
                <span>Atenção: o modo substituir apagará dados prévios do SQLite.</span>
                <button
                  type="button"
                  class="px-space-sm py-1 bg-error text-on-error rounded font-label-ui text-label-ui"
                  onclick={() => (showReplaceConfirm = true)}
                >
                  Confirmar Substituição
                </button>
              </div>
            {/if}

            {#if importMode === 'merge' || showReplaceConfirm}
              <div class="flex justify-end pt-space-xs">
                <button
                  id="btn-execute-import"
                  type="button"
                  class="px-space-md py-space-sm bg-primary text-on-primary rounded font-label-ui text-label-ui flex items-center gap-space-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                  onclick={executeImport}
                  disabled={isImporting}
                >
                  <span class="material-symbols-outlined text-[18px]">upload</span>
                  {isImporting ? 'Importando...' : 'Processar Importação'}
                </button>
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- TAB 4: INTEGRIDADE -->
      {#if activeTab === 'integrity'}
        <div class="flex flex-col gap-space-md py-space-xs">
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Inspeciona a integridade física das páginas SQLite (<code class="font-label-code text-tertiary">PRAGMA integrity_check</code>) e valida restrições de chaves estrangeiras (<code class="font-label-code text-tertiary">PRAGMA foreign_key_check</code>).
          </p>

          <div class="flex justify-start">
            <button
              id="btn-check-integrity"
              type="button"
              class="px-space-md py-space-sm bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30 rounded font-label-ui text-label-ui flex items-center gap-space-xs transition-colors disabled:opacity-50"
              onclick={handleCheckIntegrity}
              disabled={isCheckingIntegrity}
            >
              <span class="material-symbols-outlined text-[18px]">verified_user</span>
              {isCheckingIntegrity ? 'Auditando...' : 'Executar Checagem'}
            </button>
          </div>

          {#if integrityResult}
            <div class="bg-surface-container p-space-md rounded flex flex-col gap-space-sm">
              <div class="flex items-center justify-between">
                <span class="font-label-ui font-bold text-on-surface">Páginas SQLite (Integrity Check)</span>
                <span class="px-space-sm py-0.5 rounded font-label-code-sm text-label-code-sm {integrityResult.integrity_ok ? 'bg-tertiary/20 text-tertiary' : 'bg-error/20 text-error'}">
                  {integrityResult.integrity_ok ? 'OK' : 'FALHA'}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="font-label-ui font-bold text-on-surface">Chaves Estrangeiras (FK Check)</span>
                <span class="px-space-sm py-0.5 rounded font-label-code-sm text-label-code-sm {integrityResult.foreign_keys_ok ? 'bg-tertiary/20 text-tertiary' : 'bg-error/20 text-error'}">
                  {integrityResult.foreign_keys_ok ? 'OK' : `${integrityResult.fk_violations.length} VIOLAÇÕES`}
                </span>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
