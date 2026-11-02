import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = os.environ.get("REVIEW_SCRIPT", str(Path(__file__).with_name("gh-send-review.sh")))

class SendReviewTest(unittest.TestCase):
    def run_review(self, mode):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        (root / "bin").mkdir()
        store = root / "store.json"
        store.write_text(json.dumps({"files": {"file.go": [{"line": 1, "text": "review note"}]}}))
        commands = {
            "git": '#!/bin/sh\nprintf "%s\\n" "$TEST_ROOT"\n',
            "line-comment-lsp": '#!/bin/sh\nprintf "%s\\n" "$TEST_ROOT/store.json"\n',
            "gh": """#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
if args[:2] == ['repo', 'view']:
    print('owner/repo')
elif any(arg.endswith('/files') for arg in args):
    print(json.dumps({'filename': 'file.go', 'patch': '@@ -0,0 +1 @@\\n+line'}))
elif os.environ['TEST_MODE'] == 'failure':
    print('unexpected end of JSON input', file=sys.stderr)
    sys.exit(1)
elif os.environ['TEST_MODE'] == 'truncated':
    print('{')
else:
    print(json.dumps({'html_url': 'https://github.com/owner/repo/pull/1#review'}))
""",
        }
        for name, source in commands.items():
            command = root / "bin" / name
            command.write_text(source)
            command.chmod(0o755)
        result = subprocess.run(['bash', SCRIPT, '--repo', str(root), '--pr', '1', '--yes'],
            env={**os.environ, 'PATH': str(root / 'bin') + ':' + os.environ['PATH'],
                 'TEST_ROOT': str(root), 'TEST_MODE': mode}, capture_output=True, text=True)
        return root, store, result

    def test_cli_failure_preserves_request_and_diagnostics(self):
        root, store, result = self.run_review('failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(store.exists())
        payloads = list(root.glob('.tmp/review-session/*/payload.json'))
        self.assertEqual(len(payloads), 1, result.stderr)
        self.assertEqual(json.loads(payloads[0].read_text())['comments'][0]['body'], 'review note')
        self.assertIn('unexpected end of JSON input', (payloads[0].parent / 'error.txt').read_text())
        self.assertNotIn('GitHub answered', result.stderr)

    def test_truncated_response_preserves_store_and_response(self):
        root, store, result = self.run_review('truncated')
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(store.exists())
        responses = list(root.glob('.tmp/review-session/*/response.json'))
        self.assertEqual(len(responses), 1, result.stderr)
        self.assertEqual(responses[0].read_text().strip(), '{')
        self.assertIn('Check the PR before retrying', result.stderr)

    def test_success_archives_store(self):
        root, store, result = self.run_review('success')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(store.exists())
        self.assertEqual(len(list(root.glob('.tmp/review-session/*/line-comment.json'))), 1)

if __name__ == '__main__':
    unittest.main()
