"""Disposable loopback fixture; never connects to real services or storage."""

import json
from collections.abc import Mapping
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

CONTACT = {"id": "contact-test", "name": "Test Contact", "phone": "test-recipient"}


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        """Keep synthetic request logs quiet."""

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/health":
            self._reply(200, {"status": "ok"})
        elif self.headers.get("x-api-key") != "synthetic-test-key":
            self._reply(401, {"detail": "Chave x-api-key ausente ou inválida"})
        elif path == "/contacts":
            self._reply(200, {"contacts": [CONTACT]})
        elif path == "/contacts/contact-test":
            self._reply(200, CONTACT)
        elif path == "/templates":
            self._reply(200, {"templates": []})
        elif path == "/jobs/tags":
            self._reply(200, {"tags": []})
        elif path == "/jobs/runs":
            self._reply(200, {"runs": []})
        elif path == "/jobs":
            self._reply(200, {"jobs": []})
        elif path == "/backup/integrity":
            self._reply(
                200,
                {
                    "integrity_ok": True,
                    "details": ["ok"],
                    "foreign_keys_ok": True,
                    "fk_violations": [],
                },
            )
        else:
            self._reply(404, {"detail": "Synthetic resource not found"})

    def do_POST(self) -> None:
        if self.headers.get("x-api-key") != "synthetic-test-key":
            self._reply(401, {"detail": "Unauthorized synthetic request"})
        elif self.path in ("/routines/reload", "/housekeeping/purge"):
            self._reply(200, {"status": "ok"})
        else:
            self._reply(404, {"detail": "Synthetic resource not found"})

    def _reply(self, status: int, payload: Mapping[str, object]) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 18003), _Handler).serve_forever()
