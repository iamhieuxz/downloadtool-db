"""Test runner không cần pytest — chỉ dùng unittest có sẵn trong Python.

Chạy bằng: python run_tests.py
"""
import sys
import unittest

# Import test modules
sys.path.insert(0, ".")


def load_tests():
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    try:
        from test_utils import (
            TestIsValidUsername, TestCleanUsername,
            TestIsValidFilename, TestIsSafeDownloadPath,
        )
        suite.addTests(loader.loadTestsFromTestCase(TestIsValidUsername))
        suite.addTests(loader.loadTestsFromTestCase(TestCleanUsername))
        suite.addTests(loader.loadTestsFromTestCase(TestIsValidFilename))
        suite.addTests(loader.loadTestsFromTestCase(TestIsSafeDownloadPath))
    except ImportError as e:
        print(f"Không import được test_utils: {e}")

    try:
        from test_rate_limit import (
            TestDetectLimitSignal, TestRecordLimitSignal, TestSleepInterruptibly,
        )
        suite.addTests(loader.loadTestsFromTestCase(TestDetectLimitSignal))
        suite.addTests(loader.loadTestsFromTestCase(TestRecordLimitSignal))
        suite.addTests(loader.loadTestsFromTestCase(TestSleepInterruptibly))
    except ImportError as e:
        print(f"Không import được test_rate_limit: {e}")

    return suite


if __name__ == "__main__":
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(load_tests())
