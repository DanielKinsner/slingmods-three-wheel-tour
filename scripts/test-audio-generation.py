"""Offline failure-path tests. No real key, network, paid requests, or client edits."""
from pathlib import Path
from unittest.mock import patch
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('audio_generator', Path(__file__).with_name('generate-audio.py'))
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class GenerationSafety(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(generator, 'ROOT', self.root))
        self.stack.enter_context(patch.object(generator, 'CACHE', self.root / 'cache'))
        self.stack.enter_context(patch.dict('os.environ', {'ELEVENLABS_API_KEY': 'fake-test-credential'}, clear=True))
        self.request = self.stack.enter_context(patch.object(generator, 'request'))
        self.subscription = self.stack.enter_context(patch.object(generator, 'subscription', return_value=500))
        self.request.return_value = (b'ID3' + b'fake audio for safety test', {'character-cost': '8'})

    def run_generator(self, *args):
        with patch('sys.argv', ['generate-audio.py', *args]), contextlib.redirect_stdout(io.StringIO()):
            generator.main()

    def execute(self, *args):
        self.run_generator('--execute', '--max-credits', '100', '--credits-per-second-bound', '2',
                           '--pricing-evidence', 'offline fixture', *args)

    def ledger(self):
        return json.loads((self.root / 'cache/generation-ledger.json').read_text())

    def test_default_dry_run_never_calls_network(self):
        self.run_generator()
        self.request.assert_not_called()
        self.subscription.assert_not_called()

    def test_missing_secret_never_calls_network(self):
        with patch.dict('os.environ', {}, clear=True), self.assertRaises(SystemExit):
            self.execute()
        self.request.assert_not_called()
        self.subscription.assert_not_called()

    def test_no_verified_budget_never_calls_network(self):
        with self.assertRaises(SystemExit):
            self.run_generator('--execute')
        self.request.assert_not_called()

    def test_success_is_cached_by_hash_and_request(self):
        self.request.return_value = (b'ID3' + b'cached fixture', {'character-cost': '2'})
        self.execute()
        self.assertEqual(self.request.call_count, 2)
        self.execute()
        self.assertEqual(self.request.call_count, 2)
        self.assertEqual(len(self.ledger()['attempts']), 2)

    def test_timeout_consumes_request_and_reservation_before_retry(self):
        self.request.side_effect = RuntimeError('uncertain fixture')
        for _ in range(3):
            with self.assertRaises(SystemExit):
                self.execute()
        self.assertEqual(self.request.call_count, 2)
        self.assertEqual([a['status'] for a in self.ledger()['attempts']], ['uncertain', 'uncertain'])
        self.assertEqual(sum(a['reservedCredits'] for a in self.ledger()['attempts']), 32)

    def test_unknown_billing_blocks_even_after_resume(self):
        self.request.return_value = (b'ID3' + b'unknown charge fixture', {})
        for _ in range(2):
            with self.assertRaises(SystemExit):
                self.execute()
        self.assertEqual(self.request.call_count, 1)

    def test_insufficient_included_credits_submits_nothing(self):
        self.subscription.return_value = 0
        with self.assertRaises(SystemExit):
            self.execute()
        self.request.assert_not_called()

    def test_account_with_overages_enabled_is_rejected(self):
        # Call original function, not the main-loop fixture.
        original = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(original)
        with patch.object(original, 'request', return_value=(b'{"max_credit_limit_extension":1000}', {})):
            with self.assertRaises(RuntimeError):
                original.subscription('fake-test-credential')


if __name__ == '__main__':
    unittest.main()
