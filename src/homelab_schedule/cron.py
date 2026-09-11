from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from homelab_schedule.store import APP_TZ

_MAX_MINUTES = 366 * 24 * 60


def next_cron_utc(expr: str, after: datetime, tz: ZoneInfo = APP_TZ) -> datetime:
    fields = expr.split()
    if len(fields) != 5:
        raise ValueError("cron_expr must have five fields")
    local = after.astimezone(tz).replace(second=0, microsecond=0)
    cursor = local + timedelta(minutes=1)
    for _ in range(_MAX_MINUTES):
        if _cron_matches(fields, cursor):
            return cursor.astimezone(UTC)
        cursor += timedelta(minutes=1)
    raise ValueError("no matching cron occurrence within a year")


def _cron_matches(fields: list[str], instant: datetime) -> bool:
    minute, hour, dom, month, dow = fields
    if not _field_matches(minute, instant.minute, 0, 59):
        return False
    if not _field_matches(hour, instant.hour, 0, 23):
        return False
    if not _field_matches(month, instant.month, 1, 12):
        return False
    cron_dow = (instant.weekday() + 1) % 7
    dom_ok = _field_matches(dom, instant.day, 1, 31)
    dow_ok = _field_matches(dow, cron_dow, 0, 7)
    if dom == "*" and dow == "*":
        return True
    if dom != "*" and dow != "*":
        return dom_ok or dow_ok
    if dom != "*":
        return dom_ok
    return dow_ok


def _field_matches(field: str, value: int, lo: int, hi: int) -> bool:
    for part in field.split(","):
        if _part_matches(part, value, lo, hi):
            return True
    return False


def _part_matches(part: str, value: int, lo: int, hi: int) -> bool:
    if part == "*":
        return lo <= value <= hi
    if "/" in part:
        return _step_matches(part, value, lo, hi)
    if "-" in part:
        start_s, end_s = part.split("-", 1)
        return int(start_s) <= value <= int(end_s)
    parsed = int(part)
    if parsed == 7 and lo == 0 and hi == 7:
        return value in {0, 7}
    return parsed == value


def _step_matches(part: str, value: int, lo: int, hi: int) -> bool:
    base, step_s = part.split("/", 1)
    step = int(step_s)
    if step <= 0:
        return False
    if base == "*":
        return lo <= value <= hi and (value - lo) % step == 0
    if "-" in base:
        start_s, end_s = base.split("-", 1)
        start, end = int(start_s), int(end_s)
        return start <= value <= end and (value - start) % step == 0
    start = int(base)
    return start <= value <= hi and (value - start) % step == 0
