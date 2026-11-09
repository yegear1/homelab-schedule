from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
API_TS = REPO_ROOT / "web" / "src" / "lib" / "api.ts"
TYPES_TS = REPO_ROOT / "web" / "src" / "lib" / "types.ts"


def test_jobs_page_implements_job_runs_audit_contract() -> None:
    inspector_file = REPO_ROOT / "web/src/features/agenda/wdg-job-inspector.tsx"
    page_content = inspector_file.read_text(encoding="utf-8")
    api_content = API_TS.read_text(encoding="utf-8")
    types_content = TYPES_TS.read_text(encoding="utf-8")

    # Verify types contract for JobRun
    assert "export type JobRunTrigger = 'schedule' | 'manual';" in types_content
    assert "export type JobRunStatus = 'success' | 'error';" in types_content
    assert "export interface JobRun {" in types_content
    assert "duration_ms: number;" in types_content
    assert "error_message: string | null;" in types_content
    assert "export interface JobRunListResponse {" in types_content

    # Verify API client methods
    assert "getJobRuns(id: string, limit: number = 50): Promise<JobRun[]>" in api_content
    assert "getAllJobRuns(limit: number = 50, status?: string): Promise<JobRun[]>" in api_content

    # Verify JobsPage state and loading
    assert "setAuditRuns" in page_content
    assert "setLoadingRuns" in page_content
    assert "api.getJobRuns(job.id, 20)" in page_content

    # Verify JobsPage drawer section elements
    assert 'id="detail-runs-section"' in page_content
    assert 'id="btn-refresh-runs"' in page_content
    assert 'id="runs-loading"' in page_content
    assert 'id="runs-empty"' in page_content
    assert 'id="runs-list"' in page_content
    assert "Histórico de Disparos" in page_content
    assert "run.duration_ms.toFixed(1)" in page_content

