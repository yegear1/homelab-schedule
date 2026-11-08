"""Real app with disposable storage and an isolated loopback gateway for browser QA."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread

import uvicorn

from homelab_schedule.config import Settings
from homelab_schedule.main import create_app


class _Gateway(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        """Do not emit synthetic recipient or content data."""

    def do_POST(self) -> None:
        self.rfile.read(int(self.headers.get("Content-Length", "0")))
        self.send_response(202 if self.path == "/send" else 404)
        self.send_header("Content-Length", "0")
        self.end_headers()


def _run() -> None:
    with TemporaryDirectory(prefix="homelab-browser-") as directory:
        gateway = ThreadingHTTPServer(("127.0.0.1", 0), _Gateway)
        worker = Thread(target=gateway.serve_forever, daemon=True)
        worker.start()
        settings = Settings(
            schedule_api_key="synthetic-test-key",
            database_path=str(Path(directory) / "agenda.sqlite3"),
            routines_path=str(Path(directory) / "absent-routines.yaml"),
            whatsapp_api_url=f"http://127.0.0.1:{gateway.server_port}",
            whatsapp_api_key="synthetic-gateway-key",
            whatsapp_aliases="eu=test-recipient",
            _env_file=None,
        )
        try:
            uvicorn.run(create_app(settings), host="127.0.0.1", port=18004, access_log=False)
        finally:
            gateway.shutdown()
            gateway.server_close()
            worker.join()


if __name__ == "__main__":
    _run()
