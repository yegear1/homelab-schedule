import httpx
from mcp.server import MCPServer
from pydantic_settings import BaseSettings, SettingsConfigDict

from homelab_schedule.mcp_http import AgendaApi
from homelab_schedule.mcp_tools import (
    handle_cancel,
    handle_get_item,
    handle_list_agenda,
    handle_preview,
    handle_reschedule,
    handle_schedule,
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
    ) -> str:
        """Create an agenda job. when is ISO-8601, 5-field cron, relative interval
        (+15m, 2h, em 10 minutos), or friendly date/time (amanhã 14h, hoje 18:00, segunda 9h).
        to is a phone or alias. variables is an optional dictionary of custom key-value pairs
        for template interpolation.
        """
        return handle_schedule(api, when, content, to, title, variables)

    @mcp.tool()
    def list_agenda(
        status: str = "upcoming",
        limit: int = 20,
        to: str | None = None,
        query: str | None = None,
        period: str | None = None,
    ) -> str:
        """List jobs with optional filters:
        - status: upcoming, done, error, paused, all (default upcoming)
        - limit: max items to return (default 20, max 50)
        - to: filter by contact alias, phone number, or recipient (e.g. 'eu', 'mae')
        - query: text search in job title or content (e.g. 'remédio', 'reunião')
        - period: relative window ('hoje', 'amanhã', 'esta semana', '7d', '24h', etc.)
        """
        return handle_list_agenda(
            api,
            status=status,
            limit=limit,
            to=to,
            query=query,
            period=period,
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
    def reschedule(job_id: str, when: str) -> str:
        """Reschedule/snooze an existing job to a new time (ISO-8601, cron, relative
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
        )

    return mcp


def main() -> None:
    settings = McpSettings()
    client = httpx.Client(timeout=10.0)
    api = AgendaApi(settings.schedule_api_url, settings.schedule_api_key, client)
    build_mcp(api).run()


if __name__ == "__main__":
    main()
