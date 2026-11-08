import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import unittest

BASE = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, BASE / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


deploy = load('deploy')
guard = load('guard')


class InvocationTests(unittest.TestCase):
    def test_manual_only_source_skill_stays_manual_only_in_codex(self):
        with tempfile.TemporaryDirectory(dir=deploy.CACHE) as temporary:
            root = Path(temporary)
            stage = root / 'stage'
            stage.mkdir()
            home = root / 'home'
            installation = deploy.build(home, stage)
            personal = home / '.codex/harness/skills/prompt/agents/openai.yaml'
            router = home / '.codex/harness/plugins/wm/skills/code/agents/openai.yaml'
            for path in (personal, router):
                self.assertTrue(path in installation.files, f'Manual-only skill lost its Codex invocation policy: {path}')
                data = installation.files[path][0]
                self.assertIn(b'allow_implicit_invocation: false', data)

            # Native discovery sees only the explicit public aliases we own.
            codex_entries = {path.parts[-2] for path in installation.files
                             if path.parent.parent == home / '.codex/skills' and path.name == 'SKILL.md'}
            self.assertEqual(codex_entries, {'wm', 'code', 'review', 'dive', 'line-comment-act', 'line-comment-write',
                                                   'line-comment-unresolved', 'line-comment-prune', 'line-comment-distill',
                                                   'huh', 'minions', 'show-me', 'tour',
                                                   'zed-diff', 'with-proof', 'prompt', 'lessons', 'hunch', 'handoff',
                                                   'gist', 'drunk-claude', 'daily', 'and-what', 'critic'})
            for operation in ['act', 'write', 'unresolved', 'prune', 'distill']:
                alias = home / '.codex/skills' / ('line-comment-' + operation)
                self.assertIn(str(home / '.codex/harness/plugins/line-comment/internal-commands' / (operation + '.md')).encode(),
                              installation.files[alias / 'SKILL.md'][0])
                self.assertIn(b'allow_implicit_invocation: false', installation.files[alias / 'agents/openai.yaml'][0])
            for name in ['huh', 'minions', 'show-me', 'tour',
                         'zed-diff', 'with-proof', 'prompt', 'lessons', 'hunch', 'handoff',
                         'gist', 'drunk-claude', 'daily', 'and-what', 'critic']:
                alias = home / '.codex/skills' / name
                self.assertIn(str(home / '.codex/harness/skills' / name / 'SKILL.md').encode(),
                              installation.files[alias / 'SKILL.md'][0])
            self.assertIn(b'references/workflow.md', installation.files[home / '.codex/harness/skills/minions/SKILL.md'][0])
            self.assertTrue(home / '.codex/harness/skills/minions/ledger.md' in installation.files)
            self.assertFalse(installation.links)
            self.assertTrue(home / '.claude/harness/workflows/wm-code-auto.js' in installation.files)
            self.assertFalse(any(path.is_relative_to(home / '.claude/workflows') for path in installation.files))
            self.assertTrue(all(Path(source).exists() for source in installation.sources.values()),
                            'Every installed asset must map to an existing authoring source')
            for target in ('.codex', '.pi/agent'):
                index = installation.files[home / target / 'harness/skill-index.md'][0]
                self.assertIn(b'adr', index)
                self.assertIn(b'harness-maintain', index)
            adr = installation.files[home / '.claude/skills/adr/SKILL.md'][0]
            self.assertIn(b'user-invocable: false', adr)
            for path, (data, _) in installation.files.items():
                if path.name == 'SKILL.md' and path.is_relative_to(home / '.claude') and 'codex-skills' not in path.parts:
                    self.assertIn(b'user-invocable: false', data, str(path))


class WorkflowTests(unittest.TestCase):
    def test_private_auto_driver_passes_child_arguments_without_saved_name_lookup(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary)
            header = 'export const meta = {\n  name: "example", description: "example"\n}\n'
            (source / 'wm-code-impl.js').write_text(header + 'return {todo: args.todo, deploy: args.deploy}\n')
            (source / 'wm-code-auto.js').write_text(header + "return await workflow('wm-code-impl', args)\n")
            script = deploy.internal_workflows(source)['wm-code-auto.js']
            runner = """let input='';for await (const chunk of process.stdin) input+=chunk;
const {body,args}=JSON.parse(input);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
console.log(JSON.stringify(await new AsyncFunction('args',body)(args)));"""
            result = subprocess.run(['node', '--input-type=module', '-e', runner],
                                    input=json.dumps({'body': deploy.workflow_body(script), 'args': {'todo': 2, 'deploy': False}}),
                                    text=True, capture_output=True, check=True)
            self.assertEqual(json.loads(result.stdout), {'todo': 2, 'deploy': False})

    def test_real_scripts_parse_and_preserve_early_failure_without_agents(self):
        scripts = deploy.internal_workflows(deploy.HERE / 'workflows')
        runner = """let input='';for await (const chunk of process.stdin) input+=chunk;
const scripts=JSON.parse(input);const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run=body=>new AsyncFunction('args','agent','phase','log','parallel','pipeline',body);
const auto=await run(scripts.auto)({},async()=>null,()=>{},()=>{});
if(auto.result!=='ERROR'||auto.stage!=='ledger')throw new Error('lost ledger failure');
let rejected=false;try{await run(scripts.impl)({})}catch(error){rejected=error.message.includes('Name the work')}
if(!rejected)throw new Error('lost implementation argument guard');"""
        subprocess.run(['node', '--input-type=module', '-e', runner], text=True, check=True,
                       input=json.dumps({'auto': deploy.workflow_body(scripts['wm-code-auto.js']),
                                         'impl': deploy.workflow_body(scripts['wm-code-impl.js'])}))


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
            self.assertIsNone(guard.check({'tool_input': {'command': f'cat {runtime} > /tmp/harness-audit.log'}}, home))
            self.assertIsNone(guard.check({'tool_input': {'command': f'python3 /tmp/audit.py {home} > /tmp/harness-audit.log'}}, home))
            self.assertIsNone(guard.check({'tool_input': {'command': f"cat {runtime}; sed -n '1,5p' /tmp/pi-coding-agent/index.ts"}}, home))
            self.assertIsNotNone(guard.check({'tool_input': {'command': f"sed -i '' 's/a/b/' {runtime}"}}, home))


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
