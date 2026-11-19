import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import subprocess
import sys


BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE))
import wm_hooks
import deploy

ROOT = BASE.parents[1] / 'harness/plugins/wm'
MANIFEST = json.loads((ROOT / 'hooks/hooks.json').read_text())
spec = importlib.util.spec_from_file_location('wm_agents', ROOT / 'bin/wm-agents.py')
wm_agents = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wm_agents)


class WmHookTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='wm-hooks-')
        self.cwd = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)

    def run_hook(self, event, tool='', value=None, **extra):
        return wm_hooks.run_wm_hooks(ROOT, MANIFEST, event, {
            'cwd': str(self.cwd), 'session_id': 'test-session', 'tool_name': tool,
            'tool_input': value or {}, **extra,
        })

    def test_native_write_allows_text_and_blocks_invalid_metadata(self):
        for tool, path_key in [('write', 'path'), ('Write', 'file_path'), ('edit', 'filePath')]:
            with self.subTest(tool=tool):
                valid = {path_key: '.notes/spec.md', 'content': 'approve: none\n'}
                invalid = {**valid, 'content': 'approve: invalid\n', 'new_string': 'approve: invalid\n'}
                self.assertFalse(self.run_hook('PreToolUse', tool, valid)['block'])
                result = self.run_hook('PreToolUse', tool, invalid)
                self.assertTrue(result['block'])
                self.assertIn('approve', result['reason'])

    def test_pi_edit_preserves_adr_status_guard(self):
        adr = self.cwd / '.notes/adr/0001-contract.md'
        adr.parent.mkdir(parents=True)
        adr.write_text('---\nstatus: proposed\n---\n')
        result = self.run_hook('PreToolUse', 'edit', {
            'path': str(adr), 'oldText': 'status: proposed', 'newText': 'status: approved',
        })
        self.assertTrue(result['block'])
        self.assertIn('Only the operator', result['reason'])
        allowed = self.run_hook('PreToolUse', 'edit', {'path': str(adr), 'oldText': 'contract', 'newText': 'agreement'})
        self.assertFalse(allowed['block'])
        adr.write_text('---\nstatus: approved\n---\n')
        self.assertTrue(self.run_hook('PreToolUse', 'Delete', {'target_file': str(adr)})['block'])

    def test_patch_checks_each_file_before_any_edit(self):
        patch_text = '*** Begin Patch\n*** Add File: normal.md\n+hello\n*** Add File: .notes/spec.md\n+approve: invalid\n*** End Patch\n'
        result = self.run_hook('PreToolUse', 'apply_patch', {'command': patch_text})
        self.assertTrue(result['block'])
        self.assertFalse((self.cwd / 'normal.md').exists())
        self.assertFalse(self.run_hook('PreToolUse', 'patch', {'patch': patch_text.replace('invalid', 'none')})['block'])

    def test_patch_reconstructs_status_and_checks_move_destination(self):
        adr = self.cwd / '.notes/adr/0001-contract.md'
        adr.parent.mkdir(parents=True)
        adr.write_text('---\nstatus: proposed\n---\n')
        text = f'*** Begin Patch\n*** Update File: {adr}\n@@\n-status: proposed\n+status: approved\n*** End Patch\n'
        self.assertTrue(self.run_hook('PreToolUse', 'patch', {'patch': text})['block'])
        source = self.cwd / 'scratch.md'
        source.write_text('approve: none\n')
        move = '*** Begin Patch\n*** Update File: scratch.md\n*** Move to: .notes/spec.md\n@@\n-approve: none\n+approve: invalid\n*** End Patch\n'
        self.assertTrue(self.run_hook('PreToolUse', 'patch', {'patch': move})['block'])

    def test_prompt_locates_parent_notes(self):
        notes = self.cwd / '.notes'
        notes.mkdir()
        (notes / 'spec.md').write_text('---\nstatus: review\n---\n')
        child = self.cwd / 'src'
        child.mkdir()
        result = wm_hooks.run_wm_hooks(ROOT, MANIFEST, 'UserPromptSubmit', {
            'cwd': str(child), 'session_id': 'test-session', 'prompt': 'continue',
        })
        self.assertIn(str(notes), result['context'])
        self.assertIn('PHASE: review', result['context'])
        (notes / 'spec.md').unlink()
        notes.rmdir()
        self.assertEqual(self.run_hook('UserPromptSubmit', prompt='continue')['context'], '')

    def test_patch_after_delete_does_not_require_original_file(self):
        records = wm_hooks.tool_payloads({
            'cwd': str(self.cwd), 'tool_name': 'apply_patch',
            'tool_input': {'command': '*** Begin Patch\n*** Delete File: missing.md\n*** End Patch\n'},
        }, after=True)
        self.assertEqual(records[0]['tool_input']['content'], '')

    def test_patch_update_needs_no_source_read(self):
        payload = {
            'cwd': str(self.cwd), 'tool_name': 'patch',
            'tool_input': {'patch': '*** Begin Patch\n*** Update File: source.py\n@@\n-old\n+new\n*** End Patch\n'},
        }
        with patch.object(Path, 'read_text', side_effect=AssertionError('unexpected file read')):
            records = wm_hooks.tool_payloads(payload)
        self.assertEqual(records[0]['tool_name'], 'Edit')
        self.assertEqual(records[0]['tool_input']['edits'], [{'old_string': 'old', 'new_string': 'new'}])
        payload['tool_input']['patch'] = payload['tool_input']['patch'].replace('@@\n', '*** Move to: renamed.py\n@@\n')
        with patch.object(Path, 'read_text', side_effect=AssertionError('unexpected move read')):
            moved = wm_hooks.tool_payloads(payload)
        self.assertEqual(moved[1]['tool_input']['move_from'], str(self.cwd / 'source.py'))

    def test_adr_journal_stores_paths_without_contents(self):
        journal = self.cwd / 'journal.jsonl'
        payload = {
            'cwd': str(self.cwd), 'tool_name': 'write',
            'tool_input': {'path': '.notes/adr/0001-contract.md', 'content': 'private content'},
        }
        wm_hooks.record_wm_adrs(journal, payload)
        wm_hooks.record_wm_adrs(journal, payload)
        self.assertEqual(wm_hooks.session_wm_adrs(journal), [str(self.cwd / '.notes/adr/0001-contract.md')])
        self.assertNotIn('private content', journal.read_text())

    def test_result_protocols_preserve_block_and_context(self):
        denied = {'block': True, 'reason': 'stop', 'context': ''}
        allowed = {'block': False, 'reason': '', 'context': 'notes'}
        self.assertEqual(wm_hooks.runtime_output('codex', 'PreToolUse', denied), {'decision': 'block', 'reason': 'stop'})
        self.assertEqual(wm_hooks.runtime_output('cursor', 'PreToolUse', denied)['permission'], 'deny')
        self.assertEqual(wm_hooks.runtime_output('cursor', 'PreToolUse', allowed)['permission'], 'allow')
        self.assertEqual(wm_hooks.runtime_output('cursor', 'Stop', denied), {'followup_message': 'stop'})
        self.assertEqual(wm_hooks.runtime_output('codex', 'PostToolUse', allowed)['hookSpecificOutput']['additionalContext'], 'notes')

    def test_timeout_and_command_error_do_not_become_success(self):
        manifest = {'hooks': {'PreToolUse': [{'hooks': [{'type': 'command', 'command': 'false', 'timeout': 1000}]}]}}
        with self.assertRaises(RuntimeError):
            wm_hooks.run_wm_hooks(ROOT, manifest, 'PreToolUse', {'cwd': str(self.cwd)})
        with patch.object(subprocess, 'run', side_effect=subprocess.TimeoutExpired('false', 1)):
            with self.assertRaises(subprocess.TimeoutExpired):
                wm_hooks.run_wm_hooks(ROOT, manifest, 'PreToolUse', {'cwd': str(self.cwd)})

    def test_mixed_hook_output_keeps_context_and_block(self):
        reason, context = wm_hooks.hook_output('notes\n{\n"decision": "block", "reason": "deny"\n}\n')
        self.assertEqual(reason, 'deny')
        self.assertEqual(context, 'notes')


class WmAgentsTests(unittest.TestCase):
    def test_scaffold_keeps_existing_rules_and_runs_once(self):
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(temporary)
            notes = project / '.notes'
            (project / 'AGENTS.md').write_text('# Existing rules\n\nKeep this.\n')
            wm_agents.create_wm_agents(project, notes)
            first = {path: path.read_bytes() for path in project.rglob('*.md')}
            wm_agents.create_wm_agents(project, notes)
            self.assertEqual(first, {path: path.read_bytes() for path in project.rglob('*.md')})
            text = (project / 'AGENTS.md').read_text()
            self.assertTrue(text.startswith('# Existing rules\n\nKeep this.\n'))
            self.assertEqual(text.count('<!-- wm-workflow:start -->'), 1)
            for directory in (project, notes, notes / 'todos'):
                self.assertTrue((directory / 'AGENTS.md').is_file())
                self.assertEqual((directory / 'CLAUDE.md').read_text(), '@AGENTS.md\n')
            self.assertIn('/code verify', (notes / 'AGENTS.md').read_text())
            self.assertNotIn('> Copy to', (notes / 'AGENTS.md').read_text())

    def test_scaffold_preserves_legacy_instructions(self):
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(temporary)
            legacy = project / 'CLAUDE.md'
            legacy.write_text('User rules.\n')
            wm_agents.create_wm_agents(project, project / '.notes')
            self.assertEqual(legacy.read_text(), 'User rules.\n')
            self.assertTrue((project / 'AGENTS.md').read_text().startswith('User rules.\n'))


class WmHookRegistrationTests(unittest.TestCase):
    def test_all_runtime_registrations_keep_neighbors_and_repeat(self):
        with tempfile.TemporaryDirectory() as temporary:
            home = Path(temporary)
            neighbor = {'command': 'third-party-hook'}
            for folder, event, handler in (
                ('.codex', 'PreToolUse', {'hooks': [neighbor]}),
                ('.cursor', 'preToolUse', neighbor),
            ):
                directory = home / folder
                directory.mkdir()
                (directory / 'hooks.json').write_text(json.dumps({'hooks': {event: [handler]}}))
            installation = deploy.Installation(home)
            deploy.install_wm_hooks(installation, home)
            first = dict(installation.files)
            deploy.install_wm_hooks(installation, home)
            self.assertEqual(first, installation.files)
            for runtime, row in deploy.EFFORT_LEDGER['runtimes'].items():
                if runtime == 'claude':
                    continue
                directory = home / row['directory']
                self.assertIn(directory / 'harness/wm_hooks.py', installation.files)
                self.assertEqual(json.loads(installation.files[directory / 'harness/wm-hooks.json'][0]), MANIFEST)
            for folder, event in (('.codex', 'PreToolUse'), ('.cursor', 'preToolUse')):
                data = json.loads(installation.files[home / folder / 'hooks.json'][0])
                self.assertEqual(len(data['hooks'][event]), 2)
                self.assertIn('third-party-hook', json.dumps(data))
            codex = json.loads(installation.files[home / '.codex/hooks.json'][0])
            self.assertEqual(set(codex['hooks']), set(MANIFEST['hooks']))
            self.assertIn(home / '.pi/agent/extensions/wm-hooks.ts', installation.files)


if __name__ == '__main__':
    unittest.main()
