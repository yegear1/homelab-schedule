from datetime import datetime

from schemas.job import JobKind


def parse_when(when: str) -> tuple[JobKind, datetime | None, str | None]:
    stripped = when.strip()
    if len(stripped.split()) == 5:
        return JobKind.CRON, None, stripped
    parsed = datetime.fromisoformat(stripped.replace("Z", "+00:00"))
    return JobKind.ONCE, parsed, None


def default_title(content: str) -> str:
    line = content.strip().splitlines()[0] if content.strip() else "lembrete"
    return line[:120]
