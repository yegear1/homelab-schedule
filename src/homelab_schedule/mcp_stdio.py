from typing import Annotated

import httpx
from mcp.server import MCPServer
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from homelab_schedule.mcp_http import AgendaApi
from homelab_schedule.mcp_tools import (
    handle_cancel,
    handle_daily_digest,
    handle_get_item,
    handle_health_metrics,
    handle_list_agenda,
    handle_pause,
    handle_preview,
    handle_reschedule,
    handle_resume,
    handle_schedule,
    handle_snooze,
    handle_upcoming_runs,
)


class McpSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    schedule_api_url: str = "http://localhost:8003"
    schedule_api_key: str


def build_mcp(api: AgendaApi) -> MCPServer:
    mcp = MCPServer("homelab-schedule")

    @mcp.tool()
    def schedule(
        when: str,
        content: str,
        to: str = "eu",
        title: str | None = None,
        variables: dict[str, str] | None = None,
        tags: list[str] | None = None,
        until: str | None = None,
        max_runs: int | None = None,
    ) -> str:
        """Create an agenda job. when is ISO-8601, 5-field cron, relative interval
        (+15m, 2h, em 10 minutos), or friendly date/time (amanhã 14h, hoje 18:00, segunda 9h).
        to is a phone or alias. variables is an optional dictionary of custom key-value pairs
        for template interpolation. tags is an optional list of string tags or categories
        (e.g. ['saude', 'trabalho', 'casa']).
        until is an optional UTC ISO date limit to end recurring jobs.
        max_runs is an optional maximum count of successful runs before ending.
        """
        return handle_schedule(api, when, content, to, title, variables, tags, until, max_runs)

    @mcp.tool()
    def list_agenda(
        status: str = "upcoming",
        limit: int = 20,
        to: str | None = None,
        query: str | None = None,
        period: str | None = None,
        tag: str | None = None,
    ) -> str:
        """List jobs with optional filters:
        - status: upcoming, done, error, paused, all (default upcoming)
        - limit: max items to return (default 20, max 50)
        - to: filter by contact alias, phone number, or recipient (e.g. 'eu', 'mae')
        - query: text search in job title or content (e.g. 'remédio', 'reunião')
        - period: relative window ('hoje', 'amanhã', 'esta semana', '7d', '24h', etc.)
        - tag: filter by tag or category (e.g. 'saude', 'trabalho')
        """
        return handle_list_agenda(
            api,
            status=status,
            limit=limit,
            to=to,
            query=query,
            period=period,
            tag=tag,
        )

    @mcp.tool()
    def get_item(job_id: str) -> str:
        """Get one job by id, including content."""
        return handle_get_item(api, job_id)

    @mcp.tool()
    def cancel(job_id: str) -> str:
        """Cancel a sqlite job. YAML routines must be edited in routines.yaml."""
        return handle_cancel(api, job_id)

    @mcp.tool()
    def pause(job_id: str) -> str:
        """Temporarily pause an active job without deleting it."""
        return handle_pause(api, job_id)

    @mcp.tool()
    def resume(job_id: str) -> str:
        """Resume a paused job, scheduling its next occurrence."""
        return handle_resume(api, job_id)

    @mcp.tool()
    def snooze(job_id: str, when: str) -> str:
        """Postpone (snooze) the next run of a job to a future time (+15m, 1h, amanhã 10h),
        preserving the recurring cron expression intact for subsequent runs.
        """
        return handle_snooze(api, job_id, when)

    @mcp.tool()
    def reschedule(job_id: str, when: str) -> str:
        """Reschedule an existing job to a new time or pattern (ISO-8601, cron, relative
        interval +2h, or friendly time amanhã 10h).
        """
        return handle_reschedule(api, job_id, when)

    @mcp.tool()
    def preview(
        when: str,
        content: str | None = None,
        to: str = "eu",
        title: str | None = None,
        template_id: str | None = None,
        variables: dict[str, str] | None = None,
        tags: list[str] | None = None,
        until: str | None = None,
        max_runs: int | None = None,
    ) -> str:
        """Dry-run / preview an agenda job without saving. Shows recipient resolution,
        next_run_at (UTC and local), and rendered message content with dynamic and custom variables.
        """
        return handle_preview(
            api,
            when=when,
            content=content,
            to=to,
            title=title,
            template_id=template_id,
            variables=variables,
            tags=tags,
            until=until,
            max_runs=max_runs,
        )

    @mcp.tool()
    def daily_digest(
        date: str = "hoje",
        to: str | None = None,
    ) -> str:
        """Consolidate the daily agenda and detect schedule conflicts / overlapping messages.
        date is 'hoje' (default), 'amanhã', or ISO YYYY-MM-DD.
        to is an optional recipient filter (e.g. 'eu', alias, or phone number).
        Returns a compact summary with scheduled items, counts, and conflict alerts.
        """
        return handle_daily_digest(api, date=date, to=to)

    @mcp.tool()
    def upcoming_runs(
        job_id: str,
        limit: int = 5,
    ) -> str:
        """Project upcoming run times for a recurring or scheduled job.
        limit is the number of future occurrences to calculate (default 5, max 50).
        Returns a compact summary with scheduled timestamps in UTC and local time.
        """
        return handle_upcoming_runs(api, job_id=job_id, limit=limit)

    @mcp.tool()
    def health_metrics(
        window_hours: Annotated[int, Field(ge=1, le=168)] = 24,
    ) -> str:
        """Summarize stored job counts and retained attempts over 1–168 hours (default 24).
        Status flags overdue/error jobs or failed attempts. Success means gateway acceptance,
        not delivery. This does not probe scheduler or gateway availability.
        """
        return handle_health_metrics(api, window_hours)

    return mcp



def main() -> None:
    settings = McpSettings()
    client = httpx.Client(timeout=10.0)
    api = AgendaApi(settings.schedule_api_url, settings.schedule_api_key, client)
    build_mcp(api).run()


if __name__ == "__main__":
    main()
