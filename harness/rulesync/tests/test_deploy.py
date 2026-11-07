import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

BASE = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, BASE / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


deploy = load('deploy')
guard = load('guard')


class OwnershipTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.home = Path(self.temporary.name)

    def test_replaces_stow_link_without_touching_source(self):
        source = BASE / 'package.json'
        original = source.read_bytes()
        destination = self.home / '.claude/skills/example/SKILL.md'
        destination.parent.mkdir(parents=True)
        destination.symlink_to(source)
        installation = deploy.Installation(self.home)
        installation.add(Path('.claude/skills/example/SKILL.md'), b'generated', source)
        installation.publish()
        self.assertFalse(destination.is_symlink())
        self.assertEqual(source.read_bytes(), original)
        self.assertEqual(destination.read_bytes(), b'generated')

    def test_collision_aborts_before_any_write(self):
        destination = self.home / '.codex/skills/example/SKILL.md'
        destination.parent.mkdir(parents=True)
        destination.write_text('third party')
        installation = deploy.Installation(self.home)
        installation.add(Path('.claude/skills/new/SKILL.md'), b'new', BASE)
        installation.add(Path('.codex/skills/example/SKILL.md'), b'replacement', BASE)
        with self.assertRaisesRegex(RuntimeError, 'Refusing'):
            installation.publish()
        self.assertFalse((self.home / '.claude/skills/new/SKILL.md').exists())
        self.assertEqual(destination.read_text(), 'third party')

    def test_detaches_directory_link_before_writing(self):
        source = BASE / 'skills/harness-maintain'
        original = (source / 'SKILL.md').read_bytes()
        link = self.home / '.claude/skills/example'
        link.parent.mkdir(parents=True)
        link.symlink_to(source)
        installation = deploy.Installation(self.home)
        installation.add(Path('.claude/skills/example/SKILL.md'), b'generated', source / 'SKILL.md')
        installation.publish()
        self.assertFalse(link.is_symlink())
        self.assertEqual((source / 'SKILL.md').read_bytes(), original)
        self.assertEqual((link / 'SKILL.md').read_bytes(), b'generated')

    def test_changed_retired_file_aborts_before_any_write(self):
        first = deploy.Installation(self.home)
        first.add(Path('.claude/skills/old/SKILL.md'), b'original', BASE)
        first.publish()
        (self.home / '.claude/skills/old/SKILL.md').write_text('local edit')
        second = deploy.Installation(self.home)
        second.add(Path('.claude/skills/new/SKILL.md'), b'new', BASE)
        with self.assertRaisesRegex(RuntimeError, 'Retired'):
            second.publish()
        self.assertFalse((self.home / '.claude/skills/new/SKILL.md').exists())

    def test_owned_files_update_and_unmanaged_neighbor_survives(self):
        relative = Path('.pi/agent/skills/example/SKILL.md')
        first = deploy.Installation(self.home)
        first.add(relative, b'one', BASE)
        first.publish()
        neighbor = self.home / '.pi/agent/skills/third-party/SKILL.md'
        neighbor.parent.mkdir()
        neighbor.write_text('keep')
        second = deploy.Installation(self.home)
        second.add(relative, b'two', BASE)
        second.publish()
        self.assertEqual((self.home / relative).read_bytes(), b'two')
        self.assertEqual(neighbor.read_text(), 'keep')


class GuardTests(unittest.TestCase):
    def test_blocks_installed_edits_and_allows_source_and_project_edits(self):
        with tempfile.TemporaryDirectory() as temporary:
            home = Path(temporary)
            runtime = home / '.codex/skills/harness-maintain/SKILL.md'
            manifest = home / '.codex/harness/installed.json'
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps({'files': {str(runtime): {}}}))
            self.assertIsNotNone(guard.check({'cwd': str(home), 'tool_input': {'path': str(runtime)}}, home))
            patch = f'*** Begin Patch\n*** Update File: {runtime}\n@@\n-old\n+new\n*** End Patch'
            self.assertIsNotNone(guard.check({'cwd': str(home), 'tool_input': {'input': patch}}, home))
            self.assertIsNotNone(guard.check({'cwd': str(home), 'tool_input': {'command': patch}}, home))
            source_patch = f'*** Begin Patch\n*** Update File: {BASE}/guard.py\n@@\n+value = parent / child\n+example = "{runtime}"\n*** End Patch'
            self.assertIsNone(guard.check({'cwd': str(home), 'tool_input': {'command': source_patch}}, home))
            self.assertIsNone(guard.check({'cwd': str(home), 'tool_input': {'path': str(BASE / 'skills/harness-maintain/SKILL.md')}}, home))
            self.assertIsNone(guard.check({'cwd': str(home), 'tool_input': {'path': 'project/app.py'}}, home))
            self.assertIsNone(guard.check({'tool_name': 'read_file', 'tool_input': {'path': str(runtime)}}, home))
            self.assertIsNotNone(guard.check({'tool_input': {'command': f'echo broken > {runtime}'}}, home))
            self.assertIsNotNone(guard.check({'tool_input': {'command': f'rm -rf {runtime.parent.parent}'}}, home))
            self.assertIsNone(guard.check({'tool_input': {'command': f'cat {runtime}'}}, home))

    def test_resolves_runtime_skill_directory_links(self):
        with tempfile.TemporaryDirectory() as temporary:
            home = Path(temporary)
            file = home / '.codex/harness/plugins/wm/skills/code/SKILL.md'
            file.parent.mkdir(parents=True)
            file.write_text('generated')
            link = home / '.codex/skills/wm-code'
            link.parent.mkdir(parents=True)
            link.symlink_to(file.parent)
            manifest = home / '.codex/harness/installed.json'
            manifest.write_text(json.dumps({'files': {str(file): {}}}))
            self.assertIsNotNone(guard.check({'tool_input': {'file_path': str(link / 'SKILL.md')}}, home))


if __name__ == '__main__':
    unittest.main()
