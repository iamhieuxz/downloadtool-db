"""Cơ chế chống rate-limit cho gallery-dl/yt-dlp.

Chiến lược:
- Detect tín hiệu bị limit qua keyword matching trên stdout
- Random delay giữa các account (jitter) để tránh pattern detection
- Cooldown theo batch (mỗi N account thì nghỉ dài hơn)
- Sleep có thể bị ngắt giữa chừng nếu user yêu cầu dừng
"""
from __future__ import annotations

import logging
import random
import time
from dataclasses import dataclass
from typing import Callable

logger = logging.getLogger("rate_limit")


LIMIT_KEYWORDS = (
    "429",
    "too many requests",
    "rate limit",
    "rate-limit",
    "ratelimit",
    "please wait a few minutes",
    "temporarily blocked",
    "try again later",
    "login required",
    "checkpoint",
    "challenge required",
    "feedback_required",
)


@dataclass(slots=True)
class RateLimitPolicy:
    min_delay_seconds: int = 18
    max_delay_seconds: int = 45
    batch_size: int = 8
    batch_cooldown_seconds: int = 240
    suspected_limit_cooldown_seconds: int = 900
    jitter_seconds: int = 12
    max_limit_signals_before_stop: int = 2


# Type alias cho callback kiểm tra stop
StopCheckFn = Callable[[], bool]


class RateLimitGuard:
    def __init__(self, policy: RateLimitPolicy | None = None) -> None:
        self.policy = policy or RateLimitPolicy()
        self._processed_count = 0
        self._limit_signals = 0

    @property
    def processed_count(self) -> int:
        return self._processed_count

    @property
    def limit_signals(self) -> int:
        return self._limit_signals

    def detect_limit_signal(self, line: str) -> bool:
        if not line:
            return False
        lower_line = line.lower()
        return any(keyword in lower_line for keyword in LIMIT_KEYWORDS)

    def record_limit_signal(self, source: str) -> bool:
        """Ghi nhận 1 tín hiệu bị limit. Trả về True nếu đã đạt ngưỡng cần dừng."""
        self._limit_signals += 1
        logger.warning(
            "⚠️ Phát hiện dấu hiệu bị giới hạn từ %s (%s/%s).",
            source,
            self._limit_signals,
            self.policy.max_limit_signals_before_stop,
        )
        return self._limit_signals >= self.policy.max_limit_signals_before_stop

    def reset_limit_signals(self) -> None:
        self._limit_signals = 0

    def wait_after_account(self, *, stop_requested: StopCheckFn) -> None:
        self._processed_count += 1
        if self._processed_count % self.policy.batch_size == 0:
            self._sleep_interruptibly(
                self.policy.batch_cooldown_seconds,
                stop_requested=stop_requested,
                reason="nghỉ batch để giảm rủi ro bị limit",
            )
            return

        delay = random.randint(
            self.policy.min_delay_seconds, self.policy.max_delay_seconds
        )
        delay += random.randint(0, self.policy.jitter_seconds)
        self._sleep_interruptibly(
            delay, stop_requested=stop_requested, reason="giãn nhịp request"
        )

    def wait_after_limit_signal(self, *, stop_requested: StopCheckFn) -> None:
        self._sleep_interruptibly(
            self.policy.suspected_limit_cooldown_seconds,
            stop_requested=stop_requested,
            reason="nghỉ do nghi ngờ bị limit",
        )

    def _sleep_interruptibly(
        self, seconds: int, *, stop_requested: StopCheckFn, reason: str
    ) -> None:
        if seconds <= 0:
            return
        logger.info("⏳ Tạm nghỉ %s giây (%s)...", seconds, reason)
        end_time = time.monotonic() + seconds
        # Poll 1s/lần là đủ; tăng lên 2s nếu seconds lớn để giảm CPU
        poll_interval = 1.0 if seconds <= 60 else 2.0
        while time.monotonic() < end_time:
            if stop_requested():
                logger.info("⏹ Tạm nghỉ bị ngắt do yêu cầu dừng")
                return
            time.sleep(min(poll_interval, end_time - time.monotonic()))
