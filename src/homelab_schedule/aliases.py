from __future__ import annotations

import re


def parse_aliases(raw: str) -> dict[str, str]:
    aliases: dict[str, str] = {}
    for part in raw.split(","):
        item = part.strip()
        if not item or "=" not in item:
            continue
        name, target = item.split("=", 1)
        key = name.strip()
        value = target.strip()
        if key and value:
            aliases[key] = value
    return aliases


def resolve_destination(to: str, aliases: dict[str, str]) -> str:
    mapped = aliases.get(to, to)
    return normalize_whatsapp_phone(mapped)


def normalize_whatsapp_phone(raw_phone: str) -> str:
    cleaned = raw_phone.strip()
    if cleaned.endswith(("@c.us", "@g.us")):
        return cleaned
    digits_only = re.sub(r"\D", "", cleaned)
    return f"{digits_only}@c.us"
