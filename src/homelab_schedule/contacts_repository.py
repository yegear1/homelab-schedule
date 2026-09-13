from __future__ import annotations

import sqlite3

from homelab_schedule.errors import Conflict
from schemas.contact import Contact


class ContactRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def insert(self, contact: Contact) -> Contact:
        try:
            self._conn.execute(
                "INSERT INTO contacts (id, name, phone) VALUES (?, ?, ?)",
                (contact.id, contact.name, contact.phone),
            )
        except sqlite3.IntegrityError as exc:
            raise Conflict("contact name or phone already exists") from exc
        self._conn.commit()
        stored = self.get(contact.id)
        if stored is None:
            raise RuntimeError("insert did not persist contact")
        return stored

    def get(self, contact_id: str) -> Contact | None:
        row = self._conn.execute(
            "SELECT id, name, phone FROM contacts WHERE id = ?",
            (contact_id,),
        ).fetchone()
        return _row_to_contact(row)

    def get_by_name(self, name: str) -> Contact | None:
        row = self._conn.execute(
            "SELECT id, name, phone FROM contacts WHERE name = ? COLLATE NOCASE",
            (name,),
        ).fetchone()
        return _row_to_contact(row)

    def get_by_phone(self, phone: str) -> Contact | None:
        row = self._conn.execute(
            "SELECT id, name, phone FROM contacts WHERE phone = ?",
            (phone,),
        ).fetchone()
        return _row_to_contact(row)

    def list_all(self) -> list[Contact]:
        rows = self._conn.execute(
            "SELECT id, name, phone FROM contacts ORDER BY name COLLATE NOCASE"
        ).fetchall()
        return [
            contact
            for row in rows
            if (contact := _row_to_contact(row)) is not None
        ]

    def update(self, contact: Contact) -> Contact:
        try:
            cursor = self._conn.execute(
                "UPDATE contacts SET name = ?, phone = ? WHERE id = ?",
                (contact.name, contact.phone, contact.id),
            )
        except sqlite3.IntegrityError as exc:
            raise Conflict("contact name or phone already exists") from exc
        if cursor.rowcount == 0:
            return contact
        self._conn.commit()
        stored = self.get(contact.id)
        if stored is None:
            raise RuntimeError("update did not persist contact")
        return stored

    def delete(self, contact_id: str) -> None:
        self._conn.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        self._conn.commit()


def _row_to_contact(row: sqlite3.Row | None) -> Contact | None:
    if row is None:
        return None
    return Contact(id=str(row["id"]), name=str(row["name"]), phone=str(row["phone"]))
