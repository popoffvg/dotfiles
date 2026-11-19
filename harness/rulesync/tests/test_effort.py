import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import tomllib
import unittest
from unittest.mock import patch

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE))
import effort


class EffortRoutingTests(unittest.TestCase):
    def setUp(self):
        self.ledger = effort.load_effort_ledger()

    def test_symbols_resolve_both_model_and_reasoning(self):
        for runtime, row in self.ledger['runtimes'].items():
            for tier, expected in row['profiles'].items():
                with self.subTest(runtime=runtime, tier=tier):
                    profile = effort.resolve_effort_profile(self.ledger, runtime, '{' + tier + '}')
                    self.assertEqual(profile['model'], expected['model'])
                    self.assertEqual(profile['reasoning'], expected['reasoning'])
                    self.assertIn(expected['model'], profile['selector'])

    def test_mapping_change_updates_native_settings_without_source_edits(self):
        changed = copy.deepcopy(self.ledger)
        for runtime, row in changed['runtimes'].items():
            row['profiles']['medium'] = {'model': 'new-model', 'reasoning': 'high'}
            profile = effort.resolve_effort_profile(changed, runtime, '{medium}')
            source = 'name = "role"\ndeveloper_instructions = "Preserve this role."\n'
            if row['agent_format'] == 'markdown':
                source = '---\nname: role\ntools: Read\nharness-effort: "{medium}"\n---\nPreserve this role.\n'
            rendered = effort.render_effort_agent(source, runtime, profile, changed)
            self.assertIn('new-model', rendered)
            self.assertIn('high', rendered)
            self.assertIn('Preserve this role.', rendered)
            self.assertNotIn('harness-effort:', rendered)

    def test_native_toml_preserves_instructions_and_nested_config(self):
        source = 'name = "role"\nmodel = "old"\ndeveloper_instructions = \'\'\'model = "example"\nPreserve this role.\'\'\'\n[sandbox]\nmode = "restricted"\n'
        before = tomllib.loads(source)
        profile = effort.resolve_effort_profile(self.ledger, 'codex', '{heavy}')
        after = tomllib.loads(effort.render_effort_agent(source, 'codex', profile, self.ledger))
        self.assertEqual(after['developer_instructions'], before['developer_instructions'])
        self.assertEqual(after['sandbox'], before['sandbox'])
        for key, value in profile['fields'].items():
            self.assertEqual(after[key], value)

    def test_symbols_only_count_in_frontmatter(self):
        self.assertIsNone(effort.source_effort_tier('# Notes\nharness-effort: "{heavy}"\n'))
        source = '---\nharness-effort: "{medium}"\nharness-variants: "{heavy}"\n---\nBody\n'
        self.assertEqual(effort.source_effort_tier(source), 'medium')
        self.assertEqual(effort.source_effort_variants(source), ['heavy'])

    def test_tool_translation_preserves_body_and_readonly_permissions(self):
        source = '---\nname: checker\ntools: Read, Grep, Bash\n---\ntools: Write\nPreserve this role.\n'
        cursor = effort.adapt_source_agent(source, 'checker', self.ledger['runtimes']['cursor'])
        pi = effort.adapt_source_agent(source, 'checker', self.ledger['runtimes']['pi'])
        self.assertIn('readonly: true\n---\ntools: Write', cursor)
        self.assertIn('tools: read, grep, bash\n---\ntools: Write', pi)

    def test_missing_reasoning_rejects_the_ledger(self):
        del self.ledger['runtimes']['claude']['profiles']['light']['reasoning']
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'ledger.json'
            path.write_text(json.dumps(self.ledger))
            with self.assertRaisesRegex(ValueError, 'requires model and reasoning'):
                effort.load_effort_ledger(path)

    def test_explicit_model_and_effort_override_the_profile(self):
        profile = effort.resolve_effort_profile(self.ledger, 'claude', '{light}')
        original = ['claude', '-p', '--model', 'requested', '--effort=high', 'task']
        self.assertEqual(effort.effort_cli_command(profile, original), original)

    def test_invalid_tier_stops_before_launch(self):
        with patch.object(effort.subprocess, 'run') as run:
            with self.assertRaises(KeyError):
                effort.main(['claude', '{unknown}', '--', 'claude', '-p'])
            run.assert_not_called()

    def test_cli_applies_both_settings_and_preserves_provider_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'agent'
            path.write_text('#!/usr/bin/env python3\nimport json, sys\nprint(json.dumps(sys.argv[1:]))\nsys.exit(13)\n')
            path.chmod(0o755)
            result = subprocess.run([sys.executable, str(BASE / 'effort.py'), 'claude', '{medium}',
                                     '--', str(path), '-p', 'task'], text=True, capture_output=True)
            self.assertEqual(result.returncode, 13)
            expected = effort.resolve_effort_profile(self.ledger, 'claude', 'medium')
            self.assertEqual(json.loads(result.stdout), [*expected['cli'], '-p', 'task'])
