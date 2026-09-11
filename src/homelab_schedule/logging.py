from __future__ import annotations

import json
import logging
import os
import sys
from datetime import UTC, datetime

_LEVEL_ALIASES = {"warning": "warn", "warn": "warn", "critical": "error"}
_CANONICAL = {"trace_id", "request_id", "http_status", "duration_ms"}
_RESERVED = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "taskName",
    "service",
    "app",
    "env",
}


class VictoriaLogsJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        dt = datetime.fromtimestamp(record.created, tz=UTC)
        service = os.getenv("SERVICE_NAME", "homelab-schedule")
        app = os.getenv("APP", service)
        env = os.getenv("ENV", os.getenv("ENVIRONMENT", "production"))
        raw_level = record.levelname.lower()
        event: dict[str, object] = {
            "timestamp": dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": _LEVEL_ALIASES.get(raw_level, raw_level),
            "service": getattr(record, "service", service),
            "app": getattr(record, "app", app),
            "env": getattr(record, "env", env),
            "message": record.getMessage(),
        }
        if record.exc_info:
            stack = self.formatException(record.exc_info)
            event["stack_trace"] = stack
            event["message"] = f"{event['message']}\n{stack}"
        context: dict[str, object] = {}
        for key, value in record.__dict__.items():
            if key in _RESERVED:
                continue
            if key in _CANONICAL:
                event[key] = value
            else:
                context[key] = value
        if context:
            event["context"] = context
        return json.dumps(event, ensure_ascii=False)


def configure_logging() -> None:
    if os.getenv("LOG_FORMAT", "json") != "json":
        logging.basicConfig(level=logging.INFO)
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(VictoriaLogsJsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(logging.INFO)
    root.addHandler(handler)
    access = logging.getLogger("uvicorn.access")
    access.handlers.clear()
    access.propagate = False
