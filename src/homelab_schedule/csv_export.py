"""Bounded CSV serialization for the job service's read-only exports."""

import csv
import io
import json
from collections.abc import Iterable, Iterator

from pydantic import BaseModel


def _cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    text = str(value)
    if isinstance(value, str) and (
        text.lstrip().startswith(("=", "+", "-", "@"))
        or text.startswith(("\t", "\r", "\n"))
    ):
        return "'" + text
    return text


def csv_chunks(headers: tuple[str, ...], rows: Iterable[BaseModel]) -> Iterator[bytes]:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    writer.writerow(headers)
    yield b"\xef\xbb\xbf" + buffer.getvalue().encode("utf-8")
    for row in rows:
        buffer.seek(0)
        buffer.truncate(0)
        values = row.model_dump(mode="json")
        writer.writerow([_cell(values[key]) for key in headers])
        yield buffer.getvalue().encode("utf-8")
