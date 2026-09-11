from datetime import UTC, datetime

from homelab_schedule.cron import next_cron_utc
from homelab_schedule.store import APP_TZ


def test_weekly_monday_nine_skips_to_next_week() -> None:
    # Monday 14 Sep 2026 12:00 BRT (15:00 UTC) → next Monday 21 Sep 09:00 BRT
    after = datetime(2026, 9, 14, 15, 0, tzinfo=UTC)
    nxt = next_cron_utc("0 9 * * 1", after, APP_TZ)
    local = nxt.astimezone(APP_TZ)
    assert local.weekday() == 0
    assert local.hour == 9
    assert local.minute == 0
    assert local.date().isoformat() == "2026-09-21"
