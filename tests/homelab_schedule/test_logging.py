import json
import logging

from homelab_schedule.logging import VictoriaLogsJsonFormatter


def _format(level: int, message: str, **extra: object) -> dict[str, object]:
    record = logging.LogRecord(
        name="test",
        level=level,
        pathname=__file__,
        lineno=1,
        msg=message,
        args=(),
        exc_info=None,
    )
    for key, value in extra.items():
        setattr(record, key, value)
    line = VictoriaLogsJsonFormatter().format(record)
    assert "\n" not in line
    payload: object = json.loads(line)
    assert isinstance(payload, dict)
    typed: dict[str, object] = {}
    for key, value in payload.items():
        if isinstance(key, str):
            typed[key] = value
    return typed


def test_ndjson_has_canonical_fields() -> None:
    payload = _format(logging.INFO, "homelab-schedule started")
    assert payload["level"] == "info"
    assert payload["service"] == "homelab-schedule"
    assert payload["app"] == "homelab-schedule"
    assert payload["message"] == "homelab-schedule started"
    assert isinstance(payload["timestamp"], str)
    assert str(payload["timestamp"]).endswith("Z")


def test_warning_level_is_warn() -> None:
    payload = _format(logging.WARNING, "slow tick")
    assert payload["level"] == "warn"


def test_non_canonical_extra_stays_in_context() -> None:
    payload = _format(
        logging.ERROR,
        "gatekeeper_rejected",
        status_code=502,
        event="gatekeeper_rejected",
    )
    assert "status_code" not in payload
    context = payload["context"]
    assert isinstance(context, dict)
    assert context["status_code"] == 502
    assert context["event"] == "gatekeeper_rejected"
