from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_SHELL = REPO_ROOT / "web" / "src" / "components" / "AppShell.tsx"
DATA_PAGE = REPO_ROOT / "web" / "src" / "features" / "data" / "DataPage.tsx"
API_TS = REPO_ROOT / "web" / "src" / "lib" / "api.ts"
TYPES_TS = REPO_ROOT / "web" / "src" / "lib" / "types.ts"


def test_backup_ui_and_api_contract() -> None:
    shell_content = APP_SHELL.read_text(encoding="utf-8")
    data_content = DATA_PAGE.read_text(encoding="utf-8")
    components = REPO_ROOT / "web" / "src" / "features" / "data"
    data_content += "".join(p.read_text(encoding="utf-8") for p in components.glob("*.tsx"))
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

    # Entry anchors now navigate to Data; browser scenarios verify their behavior.
    assert "btn-open-backup-modal-sidebar" in shell_content
    assert "btn-open-backup-modal-header" in shell_content
    assert "onNavigate(item.path)" in shell_content
    assert "path: '/data'" in shell_content
    for anchor in (
        "btn-download-sqlite", "btn-export-json", "input-import-file",
        "btn-execute-import", "btn-check-integrity",
    ):
        assert f'id="{anchor}"' in data_content
    for label in ("Snapshot físico", "Exportar JSON", "Importar JSON", "Integridade"):
        assert label in data_content

