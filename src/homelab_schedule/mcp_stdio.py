import httpx
from mcp.server import MCPServer
from pydantic_settings import BaseSettings, SettingsConfigDict

from homelab_schedule.mcp_http import AgendaApi
from homelab_schedule.mcp_tools import (
    handle_cancel,
    handle_get_item,
    handle_list_agenda,
    handle_reschedule,
    handle_schedule,
)


class McpSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    schedule_api_url: str = "http://localhost:8002"
    schedule_api_key: str


def build_mcp(api: AgendaApi) -> MCPServer:
    mcp = MCPServer("homelab-schedule")

    @mcp.tool()
    def schedule(when: str, content: str, to: str = "eu", title: str | None = None) -> str:
        """Create an agenda job. when is ISO-8601 or cron. to is a phone or alias."""
        return handle_schedule(api, when, content, to, title)

    @mcp.tool()
    def list_agenda() -> str:
        """List upcoming jobs as a short list without full message content."""
        return handle_list_agenda(api)

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
        """Reschedule/snooze an existing job to a new time (ISO-8601 or cron)."""
        return handle_reschedule(api, job_id, when)

    return mcp


def main() -> None:
    settings = McpSettings()
    client = httpx.Client(timeout=10.0)
    api = AgendaApi(settings.schedule_api_url, settings.schedule_api_key, client)
    build_mcp(api).run()


if __name__ == "__main__":
    main()
