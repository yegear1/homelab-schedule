from homelab_schedule.dispatch import DispatchResult


class RecordingDispatcher:
    def __init__(self, status_code: int = 202) -> None:
        self.status_code = status_code
        self.calls: list[tuple[str, str]] = []

    async def send(self, *, phone_number: str, content: str) -> DispatchResult:
        self.calls.append((phone_number, content))
        if self.status_code == 202:
            return DispatchResult(
                ok=True,
                status_code=202,
                last_status="queued",
                last_error=None,
            )
        permanent = self.status_code in {401, 422}
        return DispatchResult(
            ok=False,
            status_code=self.status_code,
            last_status=None,
            last_error="gatekeeper error",
            permanent=permanent,
        )
