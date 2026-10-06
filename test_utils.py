"""Unit tests cho utils.py — chạy bằng `python run_tests.py`."""
import os
import sys
import unittest

# Cho phép import module từ thư mục cha
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils import is_valid_username, clean_username, is_valid_filename, is_safe_download_path


class TestIsValidUsername(unittest.TestCase):
    def test_valid_usernames(self):
        self.assertTrue(is_valid_username("john_doe"))
        self.assertTrue(is_valid_username("user.name"))
        self.assertTrue(is_valid_username("user-name"))
        self.assertTrue(is_valid_username("abc"))
        self.assertTrue(is_valid_username("A" * 30))

    def test_invalid_usernames(self):
        self.assertFalse(is_valid_username(""))
        self.assertFalse(is_valid_username(None))
        self.assertFalse(is_valid_username("user name"))
        self.assertFalse(is_valid_username("user<script>"))
        self.assertFalse(is_valid_username("../etc/passwd"))
        self.assertFalse(is_valid_username("user\x00null"))
        self.assertFalse(is_valid_username("A" * 31))
        self.assertFalse(is_valid_username("user@email"))


class TestCleanUsername(unittest.TestCase):
    def test_strips_url_prefix(self):
        self.assertEqual(clean_username("https://instagram.com/johndoe"), "johndoe")
        self.assertEqual(clean_username("https://www.instagram.com/johndoe"), "johndoe")

    def test_strips_trailing_slash(self):
        self.assertEqual(clean_username("johndoe/"), "johndoe")

    def test_strips_query(self):
        self.assertEqual(clean_username("johndoe?utm_source=test"), "johndoe")

    def test_xss_blocked(self):
        self.assertEqual(clean_username("<script>alert(1)</script>"), "")

    def test_path_traversal_blocked(self):
        self.assertEqual(clean_username("../../../etc/passwd"), "")


class TestIsValidFilename(unittest.TestCase):
    def test_valid(self):
        self.assertTrue(is_valid_filename("test.txt"))
        self.assertTrue(is_valid_filename("folder_name-1.0"))
        self.assertTrue(is_valid_filename("Tiếng Việt có dấu"))

    def test_invalid(self):
        self.assertFalse(is_valid_filename(""))
        self.assertFalse(is_valid_filename(None))
        self.assertFalse(is_valid_filename("../etc/passwd"))
        self.assertFalse(is_valid_filename("test/file"))
        self.assertFalse(is_valid_filename("test:file"))
        self.assertFalse(is_valid_filename("test\x00.txt"))
        self.assertFalse(is_valid_filename("CON"))
        self.assertFalse(is_valid_filename("test."))


class TestIsSafeDownloadPath(unittest.TestCase):
    def test_safe_temp_dir(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            self.assertTrue(is_safe_download_path(tmp))

    def test_unsafe_windows(self):
        self.assertFalse(is_safe_download_path("C:/Windows"))
        self.assertFalse(is_safe_download_path("C:/Windows/System32"))
        self.assertFalse(is_safe_download_path("C:/Program Files"))
        self.assertFalse(is_safe_download_path(r"C:\Windows"))

    def test_empty_or_null(self):
        self.assertFalse(is_safe_download_path(""))
        self.assertFalse(is_safe_download_path(None))
        self.assertFalse(is_safe_download_path("test\x00null"))


if __name__ == "__main__":
    unittest.main()
