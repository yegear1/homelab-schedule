from __future__ import annotations

import sqlite3

from homelab_schedule.errors import Conflict
from schemas.message_template import MessageTemplate


class TemplateRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def insert(self, template: MessageTemplate) -> MessageTemplate:
        try:
            self._conn.execute(
                "INSERT INTO templates (id, name, body) VALUES (?, ?, ?)",
                (template.id, template.name, template.body),
            )
        except sqlite3.IntegrityError as exc:
            raise Conflict("template name already exists") from exc
        self._conn.commit()
        stored = self.get(template.id)
        if stored is None:
            raise RuntimeError("insert did not persist template")
        return stored

    def get(self, template_id: str) -> MessageTemplate | None:
        row = self._conn.execute(
            "SELECT id, name, body FROM templates WHERE id = ?",
            (template_id,),
        ).fetchone()
        return _row_to_template(row)

    def body_for(self, template_id: str) -> str | None:
        stored = self.get(template_id)
        if stored is None:
            return None
        return stored.body

    def list_all(self) -> list[MessageTemplate]:
        rows = self._conn.execute(
            "SELECT id, name, body FROM templates ORDER BY name COLLATE NOCASE"
        ).fetchall()
        return [
            template
            for row in rows
            if (template := _row_to_template(row)) is not None
        ]

    def update(self, template: MessageTemplate) -> MessageTemplate:
        try:
            cursor = self._conn.execute(
                "UPDATE templates SET name = ?, body = ? WHERE id = ?",
                (template.name, template.body, template.id),
            )
        except sqlite3.IntegrityError as exc:
            raise Conflict("template name already exists") from exc
        if cursor.rowcount == 0:
            return template
        self._conn.commit()
        stored = self.get(template.id)
        if stored is None:
            raise RuntimeError("update did not persist template")
        return stored

    def delete(self, template_id: str) -> None:
        self._conn.execute("DELETE FROM templates WHERE id = ?", (template_id,))
        self._conn.commit()


def _row_to_template(row: sqlite3.Row | None) -> MessageTemplate | None:
    if row is None:
        return None
    return MessageTemplate(
        id=str(row["id"]), name=str(row["name"]), body=str(row["body"])
    )
