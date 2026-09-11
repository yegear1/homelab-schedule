from typing import Annotated

from fastapi import Depends, Header, Request

from homelab_schedule.errors import Unauthorized


def require_api_key(
    request: Request,
    x_api_key: Annotated[str | None, Header()] = None,
) -> None:
    expected = request.app.state.api_key
    if not isinstance(expected, str) or x_api_key != expected:
        raise Unauthorized("invalid or missing api key")


Auth = Annotated[None, Depends(require_api_key)]
