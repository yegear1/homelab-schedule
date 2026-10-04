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


def test_upcoming_cron_runs_generates_sequence_and_respects_until() -> None:
    from homelab_schedule.cron import upcoming_cron_runs_utc

    # Monday 14 Sep 2026 15:00 UTC
    after = datetime(2026, 9, 14, 15, 0, tzinfo=UTC)
    # Cron: every day at 10:00 BRT
    runs = upcoming_cron_runs_utc("0 10 * * *", after, limit=3, tz=APP_TZ)
    assert len(runs) == 3
    locals_ = [r.astimezone(APP_TZ) for r in runs]
    assert [loc.strftime("%Y-%m-%d %H:%M") for loc in locals_] == [
        "2026-09-15 10:00",
        "2026-09-16 10:00",
        "2026-09-17 10:00",
    ]

    # Test respecting until
    until = datetime(2026, 9, 16, 12, 0, tzinfo=APP_TZ).astimezone(UTC)
    runs_until = upcoming_cron_runs_utc("0 10 * * *", after, limit=5, tz=APP_TZ, until=until)
    assert len(runs_until) == 2
    assert [r.astimezone(APP_TZ).strftime("%Y-%m-%d") for r in runs_until] == [
        "2026-09-15",
        "2026-09-16",
    ]
