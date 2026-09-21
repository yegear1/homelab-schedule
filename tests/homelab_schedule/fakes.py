from homelab_schedule.dispatch import DispatchResult


class RecordingDispatcher:
    def __init__(
        self,
        status_code: int = 202,
        status_codes: list[int] | None = None,
    ) -> None:
        self.status_code = status_code
        self.status_codes = list(status_codes) if status_codes is not None else None
        self.calls: list[tuple[str, str]] = []

    async def send(self, *, phone_number: str, content: str) -> DispatchResult:
        self.calls.append((phone_number, content))
        code = self.status_codes.pop(0) if self.status_codes else self.status_code
        if code == 202:
            return DispatchResult(
                ok=True,
                status_code=202,
                last_status="queued",
                last_error=None,
            )
        permanent = code in {401, 422}
        return DispatchResult(
            ok=False,
            status_code=code,
            last_status=None,
            last_error="gatekeeper error",
            permanent=permanent,
        )
