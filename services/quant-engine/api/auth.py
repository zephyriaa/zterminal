from __future__ import annotations

import secrets


def is_service_authorized(authorization: str | None, expected: str | None) -> bool:
    if not expected or not authorization or not authorization.startswith("Bearer "):
        return False
    return secrets.compare_digest(authorization.removeprefix("Bearer "), expected)
