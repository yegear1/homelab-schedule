from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
JOBS_PAGE = REPO_ROOT / "web" / "src" / "pages" / "JobsPage.svelte"
API_TS = REPO_ROOT / "web" / "src" / "lib" / "api.ts"
TYPES_TS = REPO_ROOT / "web" / "src" / "lib" / "types.ts"


def test_jobs_page_implements_dead_letter_and_retry_contract() -> None:
    page_content = JOBS_PAGE.read_text(encoding="utf-8")
    api_content = API_TS.read_text(encoding="utf-8")
    types_content = TYPES_TS.read_text(encoding="utf-8")

    # Verify types contract for error and retry_count on JobListItem
    assert "last_error?: string | null;" in types_content
    assert "retry_count?: number;" in types_content

    # Verify API service methods
    assert "retryJob(id: string): Promise<Job>" in api_content
    assert "retryGroup(groupId: string): Promise<GroupActionResponse>" in api_content

    # Verify metric card 3 interactive quick filter
    assert 'id="card-metric-errors"' in page_content
    assert "filterStatus = 'error'" in page_content

    # Verify single job row Dead-Letter badge and Retry action
    assert "Dead-Letter" in page_content
    assert "handleRetry" in page_content
    assert "handleRetryGroup" in page_content

    # Verify detail panel Dead-Letter box and actions
    assert 'id="detail-dead-letter-box"' in page_content
    assert 'id="detail-dead-letter-error"' in page_content
    assert 'id="detail-dead-letter-retries"' in page_content
    assert 'id="btn-dead-letter-retry"' in page_content
    assert 'id="btn-dead-letter-run-now"' in page_content
    assert 'id="btn-detail-retry"' in page_content
