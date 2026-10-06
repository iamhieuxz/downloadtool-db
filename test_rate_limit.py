"""Unit tests cho rate_limit.py."""
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rate_limit import RateLimitGuard, RateLimitPolicy


class TestDetectLimitSignal(unittest.TestCase):
    def setUp(self):
        self.guard = RateLimitGuard(RateLimitPolicy())

    def test_detects_429(self):
        self.assertTrue(self.guard.detect_limit_signal("HTTP 429 Too Many Requests"))
        self.assertTrue(self.guard.detect_limit_signal("429"))

    def test_detects_rate_limit_text(self):
        self.assertTrue(self.guard.detect_limit_signal("Rate limit exceeded"))
        self.assertTrue(self.guard.detect_limit_signal("rate-limit triggered"))

    def test_no_false_positive(self):
        self.assertFalse(self.guard.detect_limit_signal("Downloading file.jpg"))
        self.assertFalse(self.guard.detect_limit_signal("Starting..."))
        self.assertFalse(self.guard.detect_limit_signal(""))

    def test_unicode_safe(self):
        # Tiếng Việt có dấu
        self.assertFalse(self.guard.detect_limit_signal("Đang tải tệp tin"))


class TestRecordLimitSignal(unittest.TestCase):
    def setUp(self):
        # Custom policy với max=2
        self.guard = RateLimitGuard(RateLimitPolicy(max_limit_signals_before_stop=2))

    def test_first_signal_not_stop(self):
        self.assertFalse(self.guard.record_limit_signal("test"))
        self.assertEqual(self.guard.limit_signals, 1)

    def test_second_signal_triggers_stop(self):
        self.guard.record_limit_signal("test")
        self.assertTrue(self.guard.record_limit_signal("test"))
        self.assertEqual(self.guard.limit_signals, 2)

    def test_reset(self):
        self.guard.record_limit_signal("test")
        self.guard.record_limit_signal("test")
        self.guard.reset_limit_signals()
        self.assertEqual(self.guard.limit_signals, 0)


class TestSleepInterruptibly(unittest.TestCase):
    def test_sleep_full_when_not_stopped(self):
        guard = RateLimitGuard()
        start = time.monotonic()
        # stop_fn luôn False
        guard._sleep_interruptibly(1, stop_requested=lambda: False, reason="test")
        elapsed = time.monotonic() - start
        self.assertGreaterEqual(elapsed, 0.9)
        self.assertLessEqual(elapsed, 1.5)

    def test_sleep_aborted_on_stop(self):
        guard = RateLimitGuard()
        start = time.monotonic()
        # stop_fn luôn True
        guard._sleep_interruptibly(60, stop_requested=lambda: True, reason="test")
        elapsed = time.monotonic() - start
        # Phải thoát gần như ngay lập tức
        self.assertLess(elapsed, 2.0)


if __name__ == "__main__":
    unittest.main()
