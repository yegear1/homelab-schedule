from homelab_schedule.mcp_http import AgendaApi, AgendaToolError, compact_json


def handle_schedule(
    api: AgendaApi,
    when: str,
    content: str,
    to: str = "eu",
    title: str | None = None,
) -> str:
    try:
        job = api.create_job(when=when, content=content, to=to, title=title)
        return compact_json(
            {
                "id": job.get("id"),
                "next_run_at": job.get("next_run_at"),
                "to": job.get("to"),
                "title": job.get("title"),
                "content": job.get("content"),
            }
        )
    except AgendaToolError as exc:
        return compact_json({"error": exc.message})


def handle_list_agenda(
    api: AgendaApi,
    status: str = "upcoming",
    limit: int = 20,
    to: str | None = None,
    query: str | None = None,
    period: str | None = None,
) -> str:
    try:
        return compact_json(
            api.list_agenda(
                status=status,
                limit=limit,
                to=to,
                query=query,
                period=period,
            )
        )
    except AgendaToolError as exc:
        return compact_json({"error": exc.message})


def handle_get_item(api: AgendaApi, job_id: str) -> str:
    try:
        job = api.get_item(job_id)
        return compact_json(
            {
                "id": job.get("id"),
                "title": job.get("title"),
                "content": job.get("content"),
                "to": job.get("to"),
                "kind": job.get("kind"),
                "status": job.get("status"),
                "next_run_at": job.get("next_run_at"),
                "source": job.get("source"),
            }
        )
    except AgendaToolError as exc:
        return compact_json({"error": exc.message})


def handle_cancel(api: AgendaApi, job_id: str) -> str:
    try:
        return compact_json(api.cancel(job_id))
    except AgendaToolError as exc:
        return compact_json({"error": exc.message})


def handle_reschedule(api: AgendaApi, job_id: str, when: str) -> str:
    try:
        job = api.reschedule_job(job_id=job_id, when=when)
        return compact_json(
            {
                "id": job.get("id"),
                "title": job.get("title"),
                "next_run_at": job.get("next_run_at"),
                "to": job.get("to"),
                "status": job.get("status"),
            }
        )
    except AgendaToolError as exc:
        return compact_json({"error": exc.message})


def handle_preview(
    api: AgendaApi,
    when: str,
    content: str | None = None,
    to: str = "eu",
    title: str | None = None,
    template_id: str | None = None,
) -> str:
    try:
        preview = api.preview_job(
            when=when,
            content=content,
            to=to,
            title=title,
            template_id=template_id,
        )
        return compact_json(preview)
    except AgendaToolError as exc:
        return compact_json({"error": exc.message})
