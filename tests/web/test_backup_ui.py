from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_SHELL = REPO_ROOT / "web" / "src" / "layout" / "AppShell.svelte"
BACKUP_MODAL = REPO_ROOT / "web" / "src" / "components" / "BackupModal.svelte"
API_TS = REPO_ROOT / "web" / "src" / "lib" / "api.ts"
TYPES_TS = REPO_ROOT / "web" / "src" / "lib" / "types.ts"


def test_backup_ui_and_api_contract() -> None:
    shell_content = APP_SHELL.read_text(encoding="utf-8")
    modal_content = BACKUP_MODAL.read_text(encoding="utf-8")
    api_content = API_TS.read_text(encoding="utf-8")
    types_content = TYPES_TS.read_text(encoding="utf-8")

    # Verify types contract
    assert "export type ImportMode = 'merge' | 'replace';" in types_content
    assert "export interface ExportMetadata {" in types_content
    assert "export interface ExportDataResponse {" in types_content
    assert "export interface ImportDataRequest {" in types_content
    assert "export interface ImportDataResponse {" in types_content
    assert "export interface IntegrityCheckResponse {" in types_content

    # Verify ApiService methods
    assert "downloadDatabase(): Promise<Blob>" in api_content
    assert "exportData(includeRuns: boolean = true): Promise<ExportDataResponse>" in api_content
    assert "importData(payload: ImportDataRequest): Promise<ImportDataResponse>" in api_content
    assert "checkIntegrity(): Promise<IntegrityCheckResponse>" in api_content

    # Verify AppShell triggers and modal inclusion
    assert "showBackupModal = $state(false);" in shell_content
    assert 'id="btn-open-backup-modal-sidebar"' in shell_content
    assert 'id="btn-open-backup-modal-header"' in shell_content
    assert "<BackupModal open={showBackupModal}" in shell_content

    # Verify BackupModal elements
    assert "Backup & Dados SQLite" in modal_content
    assert 'id="btn-download-sqlite"' in modal_content
    assert 'id="btn-export-json"' in modal_content
    assert 'id="input-import-file"' in modal_content
    assert 'id="btn-execute-import"' in modal_content
    assert 'id="btn-check-integrity"' in modal_content
    assert "Snapshot Físico" in modal_content
    assert "Exportar JSON" in modal_content
    assert "Importar JSON" in modal_content
    assert "Integridade" in modal_content
