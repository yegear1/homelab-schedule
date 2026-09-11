FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV LOG_FORMAT=json
ENV NO_COLOR=1
ENV SERVICE_NAME=homelab-schedule
ENV APP=homelab-schedule

COPY pyproject.toml uv.lock README.md ./
COPY src ./src
COPY routines.yaml ./routines.yaml

RUN uv sync --frozen --no-dev

EXPOSE 8002

CMD ["uvicorn", "homelab_schedule.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8002", "--workers", "1", "--no-access-log"]
