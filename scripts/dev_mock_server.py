#!/usr/bin/env python3
"""Interactive mock backend server for homelab-schedule Web UI development.

Provides realistic, pre-populated mock data (contacts, templates, recurring/once jobs,
execution history, backup/integrity) and stateful interactive endpoints on port 8003.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Homelab Schedule Dev Mock API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reference anchor time for realistic schedules
NOW = datetime.now(UTC)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


# Initial Seed Data
mock_contacts: list[dict[str, Any]] = [
    {"id": "ct-01", "name": "Alice Silva", "phone": "5511999991111"},
    {"id": "ct-02", "name": "Bob Santos (Infra)", "phone": "5511999992222"},
    {"id": "ct-03", "name": "Carlos Lima (DevOps)", "phone": "5511999993333"},
    {"id": "ct-04", "name": "Marina Souza (Financeiro)", "phone": "5511999994444"},
    {"id": "ct-05", "name": "Grupo Homelab Alertas", "phone": "1203630281928374@g.us"},
]

mock_templates: list[dict[str, Any]] = [
    {
        "id": "tmpl-01",
        "name": "Lembrete de Reunião",
        "body": "Olá {{nome}}, lembrete da reunião às {{horario}}. Link: {{link}}",
    },
    {
        "id": "tmpl-02",
        "name": "Alerta de Incidente Crítico",
        "body": "[URGENTE] Incidente no serviço {{servico}}: {{detalhes}}. Verificar.",
    },
    {
        "id": "tmpl-03",
        "name": "Boas-vindas ao Time",
        "body": "Olá {{nome}}, boas-vindas ao time da Homelab! Usuário: {{usuario}}.",
    },
    {
        "id": "tmpl-04",
        "name": "Relatório Diário de Backup",
        "body": "Rotina de backup do volume {{volume}} concluída com status: {{status}}.",
    },
    {
        "id": "tmpl-05",
        "name": "Aviso de Manutenção Programada",
        "body": "Aviso: manutenção preventiva em {{data}} às {{horario}}. Retorno: {{duracao}}.",
    },
]

mock_jobs: list[dict[str, Any]] = [
    {
        "id": "job-01",
        "title": "Backup Diário Homelab",
        "content": "Backup automático dos bancos SQLite e configurações do host.",
        "to": "ct-02",
        "target_number": "5511999992222",
        "kind": "cron",
        "run_at": None,
        "cron_expr": "0 3 * * *",
        "enabled": True,
        "source": "sqlite",
        "status": "scheduled",
        "next_run_at": _iso(NOW.replace(hour=3, minute=0, second=0) + timedelta(days=1)),
        "last_run_at": _iso(NOW.replace(hour=3, minute=0, second=0)),
        "last_status": "success",
        "last_error": None,
        "retry_count": 0,
        "created_by": "admin",
        "template_id": "tmpl-04",
        "group_id": None,
        "variables": {"volume": "data-nvme", "status": "OK (zero erros)"},
        "tags": ["backup", "infra"],
        "until": None,
        "max_runs": None,
        "run_count": 42,
    },
    {
        "id": "job-02",
        "title": "Verificação de Saúde dos Servidores",
        "content": "Checagem de consumo de CPU, memória e espaço em disco.",
        "to": "ct-05",
        "target_number": "1203630281928374@g.us",
        "kind": "cron",
        "run_at": None,
        "cron_expr": "*/30 * * * *",
        "enabled": True,
        "source": "sqlite",
        "status": "scheduled",
        "next_run_at": _iso(NOW + timedelta(minutes=15)),
        "last_run_at": _iso(NOW - timedelta(minutes=15)),
        "last_status": "success",
        "last_error": None,
        "retry_count": 0,
        "created_by": "monitor",
        "template_id": None,
        "group_id": None,
        "variables": {},
        "tags": ["ops", "alerta"],
        "until": None,
        "max_runs": None,
        "run_count": 312,
    },
    {
        "id": "job-03",
        "title": "Relatório Financeiro Semanal",
        "content": "Envio consolidado de métricas e despesas de cloud/infra.",
        "to": "ct-04",
        "target_number": "5511999994444",
        "kind": "cron",
        "run_at": None,
        "cron_expr": "0 9 * * 1",
        "enabled": True,
        "source": "sqlite",
        "status": "scheduled",
        "next_run_at": _iso(NOW + timedelta(days=3, hours=2)),
        "last_run_at": _iso(NOW - timedelta(days=4)),
        "last_status": "success",
        "last_error": None,
        "retry_count": 0,
        "created_by": "financeiro",
        "template_id": None,
        "group_id": None,
        "variables": {},
        "tags": ["finance"],
        "until": None,
        "max_runs": None,
        "run_count": 18,
    },
    {
        "id": "job-04",
        "title": "Limpeza de Logs e Temporários",
        "content": "Housekeeping semanal de arquivos temporários e caches.",
        "to": "ct-03",
        "target_number": "5511999993333",
        "kind": "cron",
        "run_at": None,
        "cron_expr": "0 2 * * 0",
        "enabled": False,
        "source": "sqlite",
        "status": "paused",
        "next_run_at": _iso(NOW + timedelta(days=6)),
        "last_run_at": _iso(NOW - timedelta(days=7)),
        "last_status": "success",
        "last_error": None,
        "retry_count": 0,
        "created_by": "carlos",
        "template_id": None,
        "group_id": None,
        "variables": {},
        "tags": ["infra", "ops"],
        "until": None,
        "max_runs": None,
        "run_count": 8,
    },
    {
        "id": "job-05",
        "title": "Renovação de Certificados Let's Encrypt",
        "content": "Verificação automatizada do vencimento de certificados SSL.",
        "to": "ct-02",
        "target_number": "5511999992222",
        "kind": "cron",
        "run_at": None,
        "cron_expr": "0 6 1 * *",
        "enabled": True,
        "source": "yaml",
        "status": "scheduled",
        "next_run_at": _iso(NOW + timedelta(days=22)),
        "last_run_at": _iso(NOW - timedelta(days=8)),
        "last_status": "success",
        "last_error": None,
        "retry_count": 0,
        "created_by": "routines.yaml",
        "template_id": None,
        "group_id": None,
        "variables": {},
        "tags": ["security", "infra"],
        "until": None,
        "max_runs": None,
        "run_count": 4,
    },
    {
        "id": "job-06",
        "title": "Reunião de Alinhamento de Sprint",
        "content": "Lembrete: alinhamento das metas da semana.",
        "to": "ct-01",
        "target_number": "5511999991111",
        "kind": "once",
        "run_at": _iso(NOW + timedelta(hours=2)),
        "cron_expr": None,
        "enabled": True,
        "source": "sqlite",
        "status": "scheduled",
        "next_run_at": _iso(NOW + timedelta(hours=2)),
        "last_run_at": None,
        "last_status": None,
        "last_error": None,
        "retry_count": 0,
        "created_by": "alice",
        "template_id": "tmpl-01",
        "group_id": None,
        "variables": {"nome": "Alice", "horario": "17:30", "link": "https://meet.jit.si/homelab"},
        "tags": ["reunião"],
        "until": None,
        "max_runs": None,
        "run_count": 0,
    },
    {
        "id": "job-07",
        "title": "Sincronização Offsite S3",
        "content": "Replicação de dados criptografados para bucket remoto.",
        "to": "ct-02",
        "target_number": "5511999992222",
        "kind": "once",
        "run_at": _iso(NOW - timedelta(hours=3)),
        "cron_expr": None,
        "enabled": False,
        "source": "sqlite",
        "status": "error",
        "next_run_at": None,
        "last_run_at": _iso(NOW - timedelta(hours=3)),
        "last_status": "error",
        "last_error": "Gateway timeout (HTTP 502): conexão recusada no endpoint remoto",
        "retry_count": 3,
        "created_by": "admin",
        "template_id": None,
        "group_id": None,
        "variables": {},
        "tags": ["backup", "ops"],
        "until": None,
        "max_runs": None,
        "run_count": 3,
    },
    {
        "id": "job-08",
        "title": "Aviso de Feriado Corporativo",
        "content": "Informamos que na próxima sexta-feira não haverá expediente presencial.",
        "to": "ct-01",
        "target_number": "5511999991111",
        "kind": "once",
        "run_at": _iso(NOW - timedelta(days=2)),
        "cron_expr": None,
        "enabled": False,
        "source": "sqlite",
        "status": "done",
        "next_run_at": None,
        "last_run_at": _iso(NOW - timedelta(days=2)),
        "last_status": "success",
        "last_error": None,
        "retry_count": 0,
        "created_by": "rh",
        "template_id": None,
        "group_id": None,
        "variables": {},
        "tags": ["aviso"],
        "until": None,
        "max_runs": None,
        "run_count": 1,
    },
    # Group batch jobs for batch test
    {
        "id": "job-batch-01",
        "title": "Deploy Release v0.4.0 (Alice)",
        "content": "Notificação sobre o novo release deployed na infraestrutura.",
        "to": "ct-01",
        "target_number": "5511999991111",
        "kind": "once",
        "run_at": _iso(NOW + timedelta(hours=4)),
        "cron_expr": None,
        "enabled": True,
        "source": "sqlite",
        "status": "scheduled",
        "next_run_at": _iso(NOW + timedelta(hours=4)),
        "last_run_at": None,
        "last_status": None,
        "last_error": None,
        "retry_count": 0,
        "created_by": "deploy-bot",
        "template_id": None,
        "group_id": "lote-deploy-v04",
        "variables": {},
        "tags": ["deploy", "lote"],
        "until": None,
        "max_runs": None,
        "run_count": 0,
    },
    {
        "id": "job-batch-02",
        "title": "Deploy Release v0.4.0 (Bob)",
        "content": "Notificação sobre o novo release deployed na infraestrutura.",
        "to": "ct-02",
        "target_number": "5511999992222",
        "kind": "once",
        "run_at": _iso(NOW + timedelta(hours=4)),
        "cron_expr": None,
        "enabled": True,
        "source": "sqlite",
        "status": "scheduled",
        "next_run_at": _iso(NOW + timedelta(hours=4)),
        "last_run_at": None,
        "last_status": None,
        "last_error": None,
        "retry_count": 0,
        "created_by": "deploy-bot",
        "template_id": None,
        "group_id": "lote-deploy-v04",
        "variables": {},
        "tags": ["deploy", "lote"],
        "until": None,
        "max_runs": None,
        "run_count": 0,
    },
    {
        "id": "job-batch-03",
        "title": "Deploy Release v0.4.0 (Carlos)",
        "content": "Notificação sobre o novo release deployed na infraestrutura.",
        "to": "ct-03",
        "target_number": "5511999993333",
        "kind": "once",
        "run_at": _iso(NOW + timedelta(hours=4)),
        "cron_expr": None,
        "enabled": True,
        "source": "sqlite",
        "status": "scheduled",
        "next_run_at": _iso(NOW + timedelta(hours=4)),
        "last_run_at": None,
        "last_status": None,
        "last_error": None,
        "retry_count": 0,
        "created_by": "deploy-bot",
        "template_id": None,
        "group_id": "lote-deploy-v04",
        "variables": {},
        "tags": ["deploy", "lote"],
        "until": None,
        "max_runs": None,
        "run_count": 0,
    },
]

mock_runs: list[dict[str, Any]] = [
    {
        "id": "run-01",
        "job_id": "job-01",
        "ran_at": _iso(NOW - timedelta(hours=12)),
        "trigger": "schedule",
        "status": "success",
        "status_code": 202,
        "duration_ms": 34.2,
        "error_message": None,
    },
    {
        "id": "run-02",
        "job_id": "job-02",
        "ran_at": _iso(NOW - timedelta(minutes=15)),
        "trigger": "schedule",
        "status": "success",
        "status_code": 202,
        "duration_ms": 19.8,
        "error_message": None,
    },
    {
        "id": "run-03",
        "job_id": "job-07",
        "ran_at": _iso(NOW - timedelta(hours=3)),
        "trigger": "manual",
        "status": "error",
        "status_code": 502,
        "duration_ms": 105.4,
        "error_message": "Gateway timeout (HTTP 502): conexão recusada no endpoint remoto",
    },
    {
        "id": "run-04",
        "job_id": "job-08",
        "ran_at": _iso(NOW - timedelta(days=2)),
        "trigger": "schedule",
        "status": "success",
        "status_code": 202,
        "duration_ms": 28.5,
        "error_message": None,
    },
    {
        "id": "run-05",
        "job_id": "job-03",
        "ran_at": _iso(NOW - timedelta(days=4)),
        "trigger": "schedule",
        "status": "success",
        "status_code": 202,
        "duration_ms": 42.1,
        "error_message": None,
    },
]


# Pydantic Input Schemas
class CreateContactModel(BaseModel):
    name: str
    phone: str


class UpdateContactModel(BaseModel):
    name: str | None = None
    phone: str | None = None


class CreateTemplateModel(BaseModel):
    name: str
    body: str


class UpdateTemplateModel(BaseModel):
    name: str | None = None
    body: str | None = None


class CreateJobModel(BaseModel):
    title: str
    content: str | None = None
    to: str
    target_number: str | None = None
    kind: str
    run_at: str | None = None
    cron_expr: str | None = None
    created_by: str | None = None
    template_id: str | None = None
    group_id: str | None = None
    variables: dict[str, str] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    until: str | None = None
    max_runs: int | None = None


class CreateBatchModel(BaseModel):
    title: str
    content: str | None = None
    recipients: list[str]
    kind: str
    run_at: str | None = None
    cron_expr: str | None = None
    created_by: str | None = None
    template_id: str | None = None
    variables: dict[str, str] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    until: str | None = None
    max_runs: int | None = None


class RescheduleModel(BaseModel):
    run_at: str | None = None
    cron_expr: str | None = None


class SnoozeModel(BaseModel):
    until: str


# --- Health & Diagnostic Routes ---
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/metrics")
def health_metrics(window_hours: int = 24) -> dict[str, Any]:
    return {
        "window_hours": window_hours,
        "total_jobs": len(mock_jobs),
        "scheduled_jobs": len([j for j in mock_jobs if j["status"] == "scheduled"]),
        "error_jobs": len([j for j in mock_jobs if j["status"] == "error"]),
        "paused_jobs": len([j for j in mock_jobs if j["status"] == "paused"]),
        "total_runs": len(mock_runs),
        "success_runs": len([r for r in mock_runs if r["status"] == "success"]),
        "error_runs": len([r for r in mock_runs if r["status"] == "error"]),
    }


# --- Contacts Routes ---
@app.get("/contacts")
def list_contacts() -> dict[str, Any]:
    return {"contacts": mock_contacts}


@app.get("/contacts/{contact_id}")
def get_contact(contact_id: str) -> dict[str, Any]:
    for c in mock_contacts:
        if c["id"] == contact_id:
            return c
    raise HTTPException(status_code=404, detail="Contato não encontrado")


@app.post("/contacts", status_code=status.HTTP_201_CREATED)
def create_contact(payload: CreateContactModel) -> dict[str, Any]:
    new_contact = {
        "id": f"ct-{uuid.uuid4().hex[:6]}",
        "name": payload.name,
        "phone": payload.phone,
    }
    mock_contacts.append(new_contact)
    return new_contact


@app.patch("/contacts/{contact_id}")
def update_contact(contact_id: str, payload: UpdateContactModel) -> dict[str, Any]:
    for c in mock_contacts:
        if c["id"] == contact_id:
            if payload.name is not None:
                c["name"] = payload.name
            if payload.phone is not None:
                c["phone"] = payload.phone
            return c
    raise HTTPException(status_code=404, detail="Contato não encontrado")


@app.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: str) -> Response:
    global mock_contacts
    mock_contacts = [c for c in mock_contacts if c["id"] != contact_id]
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Templates Routes ---
@app.get("/templates")
def list_templates() -> dict[str, Any]:
    return {"templates": mock_templates}


@app.get("/templates/{template_id}")
def get_template(template_id: str) -> dict[str, Any]:
    for t in mock_templates:
        if t["id"] == template_id:
            return t
    raise HTTPException(status_code=404, detail="Modelo não encontrado")


@app.post("/templates", status_code=status.HTTP_201_CREATED)
def create_template(payload: CreateTemplateModel) -> dict[str, Any]:
    new_template = {
        "id": f"tmpl-{uuid.uuid4().hex[:6]}",
        "name": payload.name,
        "body": payload.body,
    }
    mock_templates.append(new_template)
    return new_template


@app.patch("/templates/{template_id}")
def update_template(template_id: str, payload: UpdateTemplateModel) -> dict[str, Any]:
    for t in mock_templates:
        if t["id"] == template_id:
            if payload.name is not None:
                t["name"] = payload.name
            if payload.body is not None:
                t["body"] = payload.body
            return t
    raise HTTPException(status_code=404, detail="Modelo não encontrado")


@app.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: str) -> Response:
    global mock_templates
    mock_templates = [t for t in mock_templates if t["id"] != template_id]
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Jobs Routes ---
@app.get("/jobs/tags")
def list_tags() -> dict[str, list[str]]:
    tags_set = set()
    for job in mock_jobs:
        for tag in job.get("tags") or []:
            tags_set.add(tag)
    return {"tags": sorted(list(tags_set))}


@app.get("/jobs")
def list_jobs(
    status_filter: str | None = Query(None, alias="status"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    limit: int = 50,
    phone: str | None = None,
    group_id: str | None = None,
    query: str | None = None,
    tag: str | None = None,
) -> dict[str, Any]:
    results = list(mock_jobs)
    if status_filter and status_filter != "all":
        if status_filter == "upcoming":
            results = [j for j in results if j.get("status") in ("scheduled", "running")]
        else:
            results = [j for j in results if j.get("status") == status_filter]
    if group_id:
        results = [j for j in results if j.get("group_id") == group_id]
    if phone:
        results = [j for j in results if phone in (j.get("target_number") or "")]
    if tag:
        results = [j for j in results if tag in (j.get("tags") or [])]
    if query:
        q_lower = query.lower().strip()
        results = [
            j
            for j in results
            if q_lower in j.get("title", "").lower()
            or q_lower in (j.get("content") or "").lower()
            or q_lower in (j.get("to") or "").lower()
            or q_lower in (j.get("target_number") or "").lower()
        ]
    return {"jobs": results[:limit]}


@app.get("/jobs/runs")
def list_all_runs(
    limit: int = 50,
    status_filter: str | None = Query(None, alias="status"),
) -> dict[str, Any]:
    runs = list(mock_runs)
    if status_filter:
        runs = [r for r in runs if r.get("status") == status_filter]
    return {"runs": runs[:limit]}


@app.get("/jobs/export.csv")
def export_jobs_csv() -> Response:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "title", "to", "target_number", "kind", "status", "next_run_at", "cron_expr"
    ])
    for j in mock_jobs:
        writer.writerow([
            j.get("id"),
            j.get("title"),
            j.get("to"),
            j.get("target_number"),
            j.get("kind"),
            j.get("status"),
            j.get("next_run_at"),
            j.get("cron_expr"),
        ])
    return Response(content=output.getvalue(), media_type="text/csv")


@app.get("/jobs/runs/export.csv")
def export_runs_csv() -> Response:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "job_id", "ran_at", "trigger", "status", "status_code", "duration_ms", "error_message"
    ])
    for r in mock_runs:
        writer.writerow([
            r.get("id"),
            r.get("job_id"),
            r.get("ran_at"),
            r.get("trigger"),
            r.get("status"),
            r.get("status_code"),
            r.get("duration_ms"),
            r.get("error_message"),
        ])
    return Response(content=output.getvalue(), media_type="text/csv")


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    for j in mock_jobs:
        if j["id"] == job_id:
            return j
    raise HTTPException(status_code=404, detail="Agendamento não encontrado")


@app.post("/jobs", status_code=status.HTTP_201_CREATED)
def create_job(payload: CreateJobModel) -> dict[str, Any]:
    now_utc = datetime.now(UTC)
    target = payload.target_number
    if not target:
        for c in mock_contacts:
            if c["id"] == payload.to or c["name"] == payload.to:
                target = c["phone"]
                break
        if not target:
            target = payload.to

    next_run = payload.run_at
    if payload.kind == "cron" and not next_run:
        next_run = _iso(now_utc + timedelta(days=1))

    new_job = {
        "id": f"job-{uuid.uuid4().hex[:6]}",
        "title": payload.title,
        "content": payload.content or "",
        "to": payload.to,
        "target_number": target or payload.to,
        "kind": payload.kind,
        "run_at": payload.run_at,
        "cron_expr": payload.cron_expr,
        "enabled": True,
        "source": "sqlite",
        "status": "scheduled",
        "next_run_at": next_run,
        "last_run_at": None,
        "last_status": None,
        "last_error": None,
        "retry_count": 0,
        "created_by": payload.created_by or "web-ui",
        "template_id": payload.template_id,
        "group_id": payload.group_id,
        "variables": payload.variables,
        "tags": payload.tags,
        "until": payload.until,
        "max_runs": payload.max_runs,
        "run_count": 0,
    }
    mock_jobs.insert(0, new_job)
    return new_job


@app.post("/jobs/batch", status_code=status.HTTP_201_CREATED)
def create_batch_jobs(payload: CreateBatchModel) -> dict[str, Any]:
    group_id = f"batch-{uuid.uuid4().hex[:8]}"
    created: list[dict[str, Any]] = []
    for recipient in payload.recipients:
        single = CreateJobModel(
            title=f"{payload.title} ({recipient})",
            content=payload.content,
            to=recipient,
            kind=payload.kind,
            run_at=payload.run_at,
            cron_expr=payload.cron_expr,
            created_by=payload.created_by,
            template_id=payload.template_id,
            group_id=group_id,
            variables=payload.variables,
            tags=payload.tags,
            until=payload.until,
            max_runs=payload.max_runs,
        )
        created.append(create_job(single))
    return {"group_id": group_id, "count": len(created), "jobs": created}


@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> Response:
    for j in mock_jobs:
        if j["id"] == job_id:
            j["status"] = "done"
            j["enabled"] = False
            j["next_run_at"] = None
            return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=404, detail="Agendamento não encontrado")


@app.post("/jobs/{job_id}/pause")
def pause_job(job_id: str) -> dict[str, Any]:
    for j in mock_jobs:
        if j["id"] == job_id:
            j["status"] = "paused"
            j["enabled"] = False
            return j
    raise HTTPException(status_code=404, detail="Agendamento não encontrado")


@app.post("/jobs/{job_id}/resume")
def resume_job(job_id: str) -> dict[str, Any]:
    for j in mock_jobs:
        if j["id"] == job_id:
            j["status"] = "scheduled"
            j["enabled"] = True
            if not j.get("next_run_at"):
                j["next_run_at"] = _iso(datetime.now(UTC) + timedelta(hours=1))
            return j
    raise HTTPException(status_code=404, detail="Agendamento não encontrado")


@app.post("/jobs/{job_id}/run")
def run_job(job_id: str) -> dict[str, Any]:
    for j in mock_jobs:
        if j["id"] == job_id:
            now_iso = _iso(datetime.now(UTC))
            j["last_run_at"] = now_iso
            j["last_status"] = "success"
            j["last_error"] = None
            j["run_count"] = (j.get("run_count") or 0) + 1
            new_run = {
                "id": f"run-{uuid.uuid4().hex[:6]}",
                "job_id": job_id,
                "ran_at": now_iso,
                "trigger": "manual",
                "status": "success",
                "status_code": 202,
                "duration_ms": 24.5,
                "error_message": None,
            }
            mock_runs.insert(0, new_run)
            return {"status": "triggered", "job_id": job_id}
    raise HTTPException(status_code=404, detail="Agendamento não encontrado")


@app.post("/jobs/{job_id}/retry")
def retry_job(job_id: str) -> dict[str, Any]:
    return run_job(job_id)


@app.post("/jobs/{job_id}/snooze")
def snooze_job(job_id: str, payload: SnoozeModel) -> dict[str, Any]:
    for j in mock_jobs:
        if j["id"] == job_id:
            j["next_run_at"] = payload.until
            j["status"] = "scheduled"
            j["enabled"] = True
            return j
    raise HTTPException(status_code=404, detail="Agendamento não encontrado")


@app.post("/jobs/{job_id}/reschedule")
def reschedule_job(job_id: str, payload: RescheduleModel) -> dict[str, Any]:
    for j in mock_jobs:
        if j["id"] == job_id:
            if payload.run_at:
                j["run_at"] = payload.run_at
                j["next_run_at"] = payload.run_at
            if payload.cron_expr:
                j["cron_expr"] = payload.cron_expr
            j["status"] = "scheduled"
            j["enabled"] = True
            return j
    raise HTTPException(status_code=404, detail="Agendamento não encontrado")


# --- Group Operations ---
@app.post("/jobs/group/{group_id}/pause")
def pause_group(group_id: str) -> dict[str, Any]:
    count = 0
    for j in mock_jobs:
        if j.get("group_id") == group_id:
            j["status"] = "paused"
            j["enabled"] = False
            count += 1
    return {"group_id": group_id, "affected": count, "status": "paused"}


@app.post("/jobs/group/{group_id}/resume")
def resume_group(group_id: str) -> dict[str, Any]:
    count = 0
    for j in mock_jobs:
        if j.get("group_id") == group_id:
            j["status"] = "scheduled"
            j["enabled"] = True
            count += 1
    return {"group_id": group_id, "affected": count, "status": "resumed"}


@app.post("/jobs/group/{group_id}/cancel")
def cancel_group(group_id: str) -> dict[str, Any]:
    count = 0
    for j in mock_jobs:
        if j.get("group_id") == group_id:
            j["status"] = "done"
            j["enabled"] = False
            j["next_run_at"] = None
            count += 1
    return {"group_id": group_id, "affected": count, "status": "cancelled"}


@app.post("/jobs/group/{group_id}/run")
def run_group(group_id: str) -> dict[str, Any]:
    count = 0
    for j in mock_jobs:
        if j.get("group_id") == group_id:
            run_job(j["id"])
            count += 1
    return {"group_id": group_id, "affected": count, "status": "triggered"}


@app.post("/jobs/group/{group_id}/retry")
def retry_group(group_id: str) -> dict[str, Any]:
    return run_group(group_id)


@app.post("/jobs/group/{group_id}/snooze")
def snooze_group(group_id: str, payload: SnoozeModel) -> dict[str, Any]:
    count = 0
    for j in mock_jobs:
        if j.get("group_id") == group_id:
            j["next_run_at"] = payload.until
            j["status"] = "scheduled"
            j["enabled"] = True
            count += 1
    return {"group_id": group_id, "affected": count, "status": "snoozed"}


# --- Job Runs & Upcoming ---
@app.get("/jobs/{job_id}/runs")
def get_job_runs(job_id: str, limit: int = 50) -> dict[str, Any]:
    runs = [r for r in mock_runs if r["job_id"] == job_id]
    return {"runs": runs[:limit]}


@app.get("/jobs/{job_id}/upcoming")
def get_upcoming_runs(job_id: str, limit: int = 5) -> dict[str, Any]:
    target_job = None
    for j in mock_jobs:
        if j["id"] == job_id:
            target_job = j
            break
    if not target_job:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    items = []
    base_time = datetime.now(UTC)
    for i in range(1, limit + 1):
        dt = base_time + timedelta(days=i)
        items.append({
            "run_at": _iso(dt),
            "run_at_local": dt.strftime("%d/%m/%Y %H:%M"),
            "time_local": dt.strftime("%H:%M"),
            "formatted_date": dt.strftime("%d/%m/%Y"),
        })

    return {
        "job_id": job_id,
        "kind": target_job["kind"],
        "cron_expr": target_job.get("cron_expr"),
        "status": target_job["status"],
        "enabled": target_job["enabled"],
        "until": target_job.get("until"),
        "max_runs": target_job.get("max_runs"),
        "run_count": target_job.get("run_count", 0),
        "total_projected": len(items),
        "runs": items,
    }


# --- Backup, Integrity, Routines & Housekeeping ---
@app.get("/backup/integrity")
def check_integrity() -> dict[str, Any]:
    return {
        "integrity_ok": True,
        "details": ["database integrity check: ok", "foreign keys check: ok"],
        "foreign_keys_ok": True,
        "fk_violations": [],
    }


@app.get("/backup/export")
def export_backup(include_runs: bool = True) -> dict[str, Any]:
    return {
        "version": 1,
        "schema_version": 11,
        "exported_at": _iso(datetime.now(UTC)),
        "contacts": mock_contacts,
        "templates": mock_templates,
        "jobs": mock_jobs,
        "job_runs": mock_runs if include_runs else [],
    }


@app.post("/backup/import")
def import_backup(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "success",
        "message": "Dados importados com sucesso no ambiente mock.",
        "imported_contacts": len(data.get("contacts") or []),
        "imported_templates": len(data.get("templates") or []),
        "imported_jobs": len(data.get("jobs") or []),
    }


@app.post("/routines/reload")
def reload_routines() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/housekeeping/purge")
def housekeeping_purge() -> dict[str, Any]:
    return {"status": "ok", "deleted_count": 0}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8003, access_log=False)
