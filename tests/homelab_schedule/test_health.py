from homelab_schedule.health import ping


def test_ping_returns_ok() -> None:
    assert ping() == "ok"
