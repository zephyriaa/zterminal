import os
import sys
import unittest

ENGINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

from api.auth import is_service_authorized


class ResearchServiceAuthTests(unittest.TestCase):
    def test_job_control_denies_requests_without_a_configured_secret(self):
        self.assertFalse(is_service_authorized(None, None))
        self.assertFalse(is_service_authorized("Bearer anything", None))

    def test_job_control_requires_server_secret(self):
        self.assertFalse(is_service_authorized("Bearer wrong", "test-secret"))
        self.assertFalse(is_service_authorized("test-secret", "test-secret"))
        self.assertTrue(is_service_authorized("Bearer test-secret", "test-secret"))
