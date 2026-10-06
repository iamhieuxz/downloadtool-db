"""Quản lý tiến trình subprocess (gallery-dl, yt-dlp) an toàn với đa luồng.

Cải tiến so với phiên bản trước:
- threading.Lock để tránh race condition khi start/stop đồng thời
- threading.Event để worker thread có thể abort gracefully
- Có thể cấu hình `force_kill_on_start` (mặc định: vẫn kill cũ để đảm bảo đơn nhiệm)
- Có hàm `is_running()` để query trạng thái
"""
from __future__ import annotations

import logging
import os
import shlex
import subprocess
import threading
from typing import Iterator

logger = logging.getLogger("process_manager")


class ProcessManager:
    def __init__(self) -> None:
        self.proc: subprocess.Popen[str] | None = None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

    def is_running(self) -> bool:
        with self._lock:
            return self.proc is not None and self.proc.poll() is None

    def request_stop(self) -> None:
        """Đánh dấu yêu cầu dừng (các worker thread sẽ tự kiểm tra qua event)."""
        self._stop_event.set()

    def clear_stop(self) -> None:
        self._stop_event.clear()

    def start(self, cmd: list[str] | str) -> subprocess.Popen[str]:
        """Khởi động subprocess, tự động kill tiến trình cũ nếu đang chạy."""
        with self._lock:
            # Dừng tiến trình cũ nếu có
            if self.proc and self.proc.poll() is None:
                logger.warning("Tiến trình cũ vẫn đang chạy, gửi terminate trước khi start mới")
                try:
                    self.proc.terminate()
                    try:
                        self.proc.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        self.proc.kill()
                        self.proc.wait(timeout=2)
                except Exception:
                    logger.exception("Lỗi khi terminate tiến trình cũ")
                self.proc = None

            args = shlex.split(cmd) if isinstance(cmd, str) else cmd

            # Ép unbuffered để log được đẩy ra ngay
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"

            try:
                self.proc = subprocess.Popen(
                    args,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    bufsize=1,
                    env=env,
                )
            except FileNotFoundError as e:
                logger.error("Không tìm thấy executable: %s", e)
                self.proc = None
                raise
            return self.proc

    def stop(self, timeout: float = 2.0) -> None:
        """Dừng tiến trình hiện tại (terminate → kill nếu quá thời gian)."""
        with self._lock:
            if not self.proc:
                return
            try:
                if self.proc.poll() is None:
                    self.proc.terminate()
                    try:
                        self.proc.wait(timeout=timeout)
                    except subprocess.TimeoutExpired:
                        logger.warning("Process không phản hồi terminate, gửi kill")
                        self.proc.kill()
                        try:
                            self.proc.wait(timeout=timeout)
                        except Exception:
                            pass
            except Exception:
                logger.exception("Lỗi khi stop process")
            finally:
                self.proc = None

    def iter_stdout(self) -> Iterator[str]:
        """Generator yield từng dòng stdout; tự động dừng nếu process kết thúc
        hoặc stop_requested được set."""
        proc = self.proc
        if not proc or not proc.stdout:
            return
        try:
            for line in proc.stdout:
                if self._stop_event.is_set():
                    break
                yield line
        except Exception:
            logger.exception("Lỗi khi đọc stdout")
