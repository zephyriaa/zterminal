"""Exercise Windows file sharing during the helper's atomic status publication."""
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest

from child import atomic


@unittest.skipUnless(os.name == 'nt', 'Windows file sharing regression')
class StatusPublicationTests(unittest.TestCase):
    def test_reader_does_not_crash_status_publication(self):
        with tempfile.TemporaryDirectory() as root:
            status = Path(root) / 'status.json'
            atomic(status, {'stage': 'running_strategy'})
            ready = threading.Event()
            observed = []
            def read_status():
                with status.open('r', encoding='utf-8') as reader:
                    ready.set()
                    time.sleep(.1)
                    observed.append(json.load(reader)['stage'])
            reader = threading.Thread(target=read_status)
            reader.start()
            self.assertTrue(ready.wait(2))
            try:
                atomic(status, {'stage': 'saving_result'})
            finally:
                reader.join(2)
            self.assertFalse(reader.is_alive())
            self.assertEqual(observed, ['running_strategy'])
            self.assertEqual(json.loads(status.read_text())['stage'], 'saving_result')

    def test_persistent_lock_is_a_bounded_error(self):
        with tempfile.TemporaryDirectory() as root:
            status = Path(root) / 'status.json'
            atomic(status, {'stage': 'running_strategy'})
            started = time.monotonic()
            with status.open('r', encoding='utf-8'):
                with self.assertRaises(PermissionError):
                    atomic(status, {'stage': 'saving_result'})
            self.assertLess(time.monotonic() - started, 2)
            self.assertEqual(json.loads(status.read_text())['stage'], 'running_strategy')


if __name__ == '__main__':
    unittest.main()
