from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENDA_DIR = REPO_ROOT / "web" / "src" / "features" / "agenda"
API_TS = REPO_ROOT / "web" / "src" / "lib" / "api.ts"
TYPES_TS = REPO_ROOT / "web" / "src" / "lib" / "types.ts"


def test_jobs_page_implements_dead_letter_and_retry_contract() -> None:
    page_content = "".join(
        path.read_text(encoding="utf-8") for path in AGENDA_DIR.glob("*.tsx")
    )
    store_content = (REPO_ROOT / "web/src/stores/jobs.ts").read_text(encoding="utf-8")
    full_content = page_content + store_content
    api_content = API_TS.read_text(encoding="utf-8")
    types_content = TYPES_TS.read_text(encoding="utf-8")

    # Verify types contract for error and retry_count on JobListItem
    assert "last_error?: string | null;" in types_content
    assert "retry_count?: number;" in types_content

    # Verify API service methods
    assert "retryJob(id: string): Promise<Job>" in api_content
    assert "retryGroup(groupId: string): Promise<GroupActionResponse>" in api_content

    # Verify metric card 3 interactive quick filter
    assert 'id="card-metric-errors"' in full_content
    assert "setStatusFilter('error')" in full_content

    # Verify single job row Dead-Letter badge and Retry action
    assert "Falha na execução" in full_content
    assert "api.retryJob(id)" in full_content
    assert "api.retryGroup(groupId)" in full_content

    # Verify detail panel Dead-Letter box and actions
    assert 'id="detail-dead-letter-box"' in full_content
    assert 'id="detail-dead-letter-error"' in full_content
    assert 'id="detail-dead-letter-retries"' in full_content
    assert "btn-dead-letter-retry" in full_content
    assert "btn-dead-letter-run-now" in full_content
    assert "btn-detail-retry" in full_content

