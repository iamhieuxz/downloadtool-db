"""Module xác thực đơn giản cho local web server.

Sinh một token ngẫu nhiên khi khởi động, lưu vào file .secret trong thư mục app.
Mọi request thay đổi state (POST, DELETE, PUT) đều phải kèm token trong header
`X-Auth-Token` hoặc query param `?token=...`.

Lưu ý: Đây là bảo vệ cơ bản chống truy cập LAN/local không mong muốn,
KHÔNG phải cơ chế bảo mật production-grade.
"""
from __future__ import annotations

import hashlib
import os
import secrets
from pathlib import Path

_SECRET_FILE = Path(__file__).parent / ".secret"


def _load_or_create_secret() -> str:
    """Đọc secret từ file, nếu chưa có thì sinh mới và lưu lại."""
    try:
        if _SECRET_FILE.exists():
            token = _SECRET_FILE.read_text(encoding="utf-8").strip()
            if token:
                return token
    except Exception:
        pass

    # Sinh secret mới: 32 bytes random -> sha256 hex
    token = hashlib.sha256(secrets.token_bytes(32)).hexdigest()
    try:
        _SECRET_FILE.write_text(token, encoding="utf-8")
    except Exception:
        pass
    return token


AUTH_TOKEN: str = _load_or_create_secret()


def verify_token(provided: str | None) -> bool:
    """Xác thực token (so sánh constant-time để chống timing attack)."""
    if not provided:
        return False
    return secrets.compare_digest(str(provided), AUTH_TOKEN)
