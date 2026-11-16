import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]


class TurnTriageTests(unittest.TestCase):
    def test_claude_reads_the_shared_rule(self):
        path = ROOT / 'harness/claude/hooks/turn-triage.py'
        spec = importlib.util.spec_from_file_location('turn_triage', path)
        hook = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(hook)
        shared = json.loads((ROOT / 'harness/claude/scripts/turn-triage.json').read_text())
        self.assertEqual(hook.RULE, shared['rule'])
        for state in ('done', 'wait', 'question'):
            self.assertEqual(hook.read_tag('Reply\ntriage: ' + state), state)
        self.assertIsNone(hook.read_tag('No tag'))

    def test_zed_shell_preserves_cli_settings_and_arguments(self):
        aliases = (ROOT / 'zsh/dot-zshrc_aliases').read_text()
        function = 'opencode() {' + aliases.split('opencode() {', 1)[1].split('\n}\n', 1)[0] + '\n}\n'
        with tempfile.TemporaryDirectory() as temporary:
            command = Path(temporary) / 'opencode'
            command.write_text('#!/bin/sh\nprintf \'%s\\n\' "$OPENCODE_CLI_CONFIG_CONTENT" "$@"\n')
            command.chmod(0o755)
            original = {'theme': {'name': 'test'}, 'terminal': {'copy': 'manual', 'title': True}}
            env = {**os.environ, 'PATH': temporary + ':' + os.environ['PATH'],
                   'OPENCODE_CLI_CONFIG_CONTENT': json.dumps(original)}
            for zed in ('true', 'false'):
                with self.subTest(zed=zed):
                    result = subprocess.run(['zsh', '-c', function + 'opencode --session "a b"'],
                                            env={**env, 'ZED_TERM': zed}, check=True, capture_output=True, text=True)
                    lines = result.stdout.splitlines()
                    expected = {**original, 'terminal': {**original['terminal'], 'title': zed != 'true'}}
                    self.assertEqual(json.loads(lines[0]), expected)
                    self.assertEqual(lines[1:], ['--session', 'a b'])
            env.pop('OPENCODE_CLI_CONFIG_CONTENT')
            result = subprocess.run(['zsh', '-c', function + 'opencode'], env={**env, 'ZED_TERM': 'true'},
                                    check=True, capture_output=True, text=True)
            self.assertEqual(json.loads(result.stdout), {'terminal': {'title': False}})


if __name__ == '__main__':
    unittest.main()
