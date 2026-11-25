import importlib.util
from itertools import product
import json
import os
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE))


def load(name):
    spec = importlib.util.spec_from_file_location(name, BASE / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


deploy = load('deploy')
guard = load('guard')


class InvocationTests(unittest.TestCase):
    def assert_effort_profile(self, data, profile):
        for value in profile['fields'].values():
            self.assertIn(value.encode(), data)

    def test_manual_only_source_skill_stays_manual_only_in_codex(self):
        with tempfile.TemporaryDirectory(dir=deploy.CACHE) as temporary:
            root = Path(temporary)
            stage = root / 'stage'
            stage.mkdir()
            home = root / 'home'
            installation = deploy.build(home, stage)
            personal = home / '.codex/harness/skills/deliver/agents/openai.yaml'
            router = home / '.codex/harness/plugins/wm/skills/code/agents/openai.yaml'
            for path in (personal, router):
                self.assertTrue(path in installation.files, f'Manual-only skill lost its Codex invocation policy: {path}')
                data = installation.files[path][0]
                self.assertIn(b'allow_implicit_invocation: false', data)

            # Native discovery sees only the explicit public aliases we own.
            codex_entries = {path.parts[-2] for path in installation.files
                             if path.parent.parent == home / '.codex/skills' and path.name == 'SKILL.md'}
            self.assertEqual(codex_entries, set(deploy.CONFIG['publicAliases']))
            for operation in ['act', 'write', 'unresolved', 'prune', 'distill']:
                alias = home / '.codex/skills' / ('line-comment-' + operation)
                self.assertIn(str(home / '.codex/harness/plugins/line-comment/internal-commands' / (operation + '.md')).encode(),
                              installation.files[alias / 'SKILL.md'][0])
                self.assertIn(b'allow_implicit_invocation: false', installation.files[alias / 'agents/openai.yaml'][0])
            for name in ['huh', 'minions', 'show-me', 'tour-v2',
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
            missing_sources = {str(path): source for path, source in installation.sources.items() if not Path(source).exists()}
            self.assertFalse(missing_sources, 'Installed assets need authoring sources: ' + str(missing_sources))
            for target in ('.codex', '.pi/agent', '.config/opencode'):
                index = installation.files[home / target / 'harness/skill-index.md'][0]
                self.assertIn(b'adr', index)
                self.assertIn(b'harness-maintain', index)
                instructions = installation.files[home / target / 'AGENTS.md'][0]
                self.assertIn(b'Before you show something to the user, load the `show-me` skill.', instructions)
                self.assertIn(b'# Quint models', instructions)
                self.assertNotIn(b'@rules/', instructions)
            opencode = home / '.config/opencode'
            commands = {path.stem for path in installation.files if path.parent == opencode / 'commands'}
            self.assertEqual(commands, set(deploy.CONFIG['publicAliases']))
            self.assertFalse(any(path.is_relative_to(opencode / 'skills') for path in installation.files))
            settings = json.loads(installation.files[opencode / 'opencode.json'][0])
            self.assertEqual(settings['model'], 'openai/gpt-6.1-sol')
            self.assertTrue(settings['snapshots'])
            triage = installation.files[opencode / 'harness/turn-triage.json'][0]
            self.assertEqual(triage, installation.files[home / '.claude/scripts/turn-triage.json'][0])
            plugin = installation.files[opencode / 'plugins/turn-triage/triage-state.ts'][0]
            self.assertIn(str(opencode / 'harness/turn-triage.json').encode(), plugin)
            self.assertNotIn(b'{{HOME}}', plugin)
            agent = installation.files[opencode / 'agents/wm-researcher.md'][0]
            self.assertIn(b'mode: subagent', agent)
            self.assertNotIn(b'${CLAUDE_PLUGIN_ROOT}', agent)
            ledger = deploy.effort.load_effort_ledger()
            for runtime, row in ledger['runtimes'].items():
                for tier in ledger['tiers']:
                    profile = deploy.effort.resolve_effort_profile(ledger, runtime, tier)
                    suffix = '.toml' if row['agent_format'] == 'toml' else '.md'
                    data = installation.files[home / row['directory'] / 'agents' / ('effort-' + tier + suffix)][0]
                    self.assert_effort_profile(data, profile)
                self.assertIn(home / row['directory'] / 'harness/effort-ledger.json', installation.files)
            for runtime in ('claude', 'opencode', 'codex', 'pi', 'cursor'):
                row = ledger['runtimes'][runtime]
                name = 'implementer-heavy' if runtime == 'claude' else 'wm-implementer-heavy'
                folder = 'harness/plugins/wm/agents' if runtime == 'claude' else 'agents'
                suffix = '.toml' if runtime == 'codex' else '.md'
                data = installation.files[home / row['directory'] / folder / (name + suffix)][0]
                self.assert_effort_profile(data, deploy.effort.resolve_effort_profile(ledger, runtime, 'heavy'))
            for runtime in ('.claude/skills', '.codex/harness/skills', '.pi/agent/harness/skills', '.config/opencode/harness/skills'):
                ledger = installation.files[home / runtime / 'minions/ledger.md'][0]
                self.assertIn(b'effort-ledger.json', ledger)
                for tier in (b'light', b'medium', b'heavy'):
                    self.assertIn(tier, ledger)
                self.assertNotRegex(ledger, rb'haiku|sonnet|opus|gpt-\d|composer')
            self.assertEqual(installation.files[home / '.claude/CLAUDE.md'][0], b'@AGENTS.md\n')
            self.assertIn(b'@rules/quint.md', installation.files[home / '.claude/AGENTS.md'][0])
            adr = installation.files[home / '.claude/skills/adr/SKILL.md'][0]
            self.assertIn(b'user-invocable: false', adr)
            public_skills = set(deploy.CONFIG['publicAliases']) & set(deploy.loose_skill_dirs())
            for name in public_skills:
                self.assertIn(b'user-invocable: true', installation.files[home / '.claude/skills' / name / 'SKILL.md'][0], name)
                self.assertNotIn(home / '.claude/commands' / (name + '.md'), installation.files)
            for name in ['wm', 'line-comment-act']:
                self.assertTrue(home / '.claude/commands' / (name + '.md') in installation.files, name)
            entry_skills = {home / '.claude/harness/plugins/wm/skills' / name / 'SKILL.md' for name in ['code', 'review', 'dive']}
            for path in entry_skills:
                self.assertIn(b'user-invocable: true', installation.files[path][0], str(path))
                self.assertNotIn(home / '.claude/commands' / (path.parent.name + '.md'), installation.files)
            for path, (data, _) in installation.files.items():
                if (path.name == 'SKILL.md' and path.is_relative_to(home / '.claude') and 'codex-skills' not in path.parts
                        and path.parent.name not in public_skills and path not in entry_skills):
                    self.assertIn(b'user-invocable: false', data, str(path))


class LooseSkillGroupTests(unittest.TestCase):
    def skill(self, root, path):
        (root / path).mkdir(parents=True)
        (root / path / 'SKILL.md').write_text('---\nname: x\n---\n')

    def test_grouped_skills_map_by_name(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.skill(root, 'base/show-me')
            self.skill(root, 'other/firecrawl')
            self.assertEqual(deploy.loose_skill_dirs(root),
                             {'show-me': root / 'base/show-me', 'firecrawl': root / 'other/firecrawl'})

    def test_same_name_in_two_groups_stops_the_deploy(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.skill(root, 'base/tour')
            self.skill(root, 'everyday/tour')
            with self.assertRaisesRegex(RuntimeError, 'two group folders'):
                deploy.loose_skill_dirs(root)

    def test_skill_outside_a_group_stops_the_deploy(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.skill(root, 'tour')
            with self.assertRaisesRegex(RuntimeError, 'outside a group folder'):
                deploy.loose_skill_dirs(root)


class WorkflowTests(unittest.TestCase):
    def test_workflow_agents_keep_effort_through_implementation_and_fixups(self):
        scripts = deploy.internal_workflows(deploy.HERE / 'workflows')
        runner = """let input='';for await(const chunk of process.stdin)input+=chunk;
const scripts=JSON.parse(input);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
for(const [name,body] of Object.entries(scripts)){
  const calls=[];let reviews=0;let deploys=0;
  const agent=async(prompt,options)=>{
    if(Object.hasOwn(options,'model'))throw new Error('model override: '+options.label);
    if(options.agentType==='general-purpose')throw new Error('missing effort route: '+options.label);
    if((options.label.startsWith('impl:')||options.label.startsWith('fixup:'))&&options.agentType!=='wm:implementer-heavy')
      throw new Error('red risk did not retain heavy effort');
    calls.push(options.label);
    if(options.label==='ledger')return {todos:[{todo:1,status:'todo',risk:'red'}],deployTask:'deploy',e2eCommand:'verify'};
    if(options.label.startsWith('adr-approval:'))return {exit:0,stdout:''};
    if(options.phase==='Review')return ++reviews===1
      ? {exit:1,base:'base',failed:[{rule:'rule',severity:'high',findings:['Fix the behavior.']}]}
      : {exit:0,base:'base',failed:[]};
    if(options.phase==='Deploy')return {result:++deploys===1?'red':'green',ran:'deploy',output:''};
    if(options.phase==='Verify')return {result:'green',ran:'verify',output:''};
    if(options.phase==='Lessons')return {appended:[]};
    if(options.phase==='Status')return {status:'done',commit:'commit',outcome:'done'};
    if(options.phase==='Reconcile')return {statuses:[{todo:1,status:'done'}]};
    return {status:'done',summary:'done'};
  };
  const result=await new AsyncFunction('args','agent','phase','log','parallel','pipeline',body)
    ({todo:1,risk:'red'},agent,()=>{},()=>{},()=>{},()=>{});
  if(result.result!=='PASS')throw new Error(name+': '+JSON.stringify(result));
  if(!calls.some(label=>label.startsWith('impl:')))throw new Error('implementation not exercised');
  if(reviews<2)throw new Error('review fixup not exercised');
  if(name==='auto'&&!calls.some(label=>label.startsWith('fix:')))throw new Error('deploy fix not exercised');
}"""
        subprocess.run(['node', '--input-type=module', '-e', runner], text=True, check=True,
                       input=json.dumps({'auto': deploy.workflow_body(scripts['wm-code-auto.js']),
                                         'impl': deploy.workflow_body(scripts['wm-code-impl.js'])}))

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

class EffortHelperTests(unittest.TestCase):
    def test_skill_helpers_apply_effort_and_preserve_model_override(self):
        for script, model in product(('agent-impl.sh', 'dive-grill-questions.sh'), ('', 'requested-model')):
            with self.subTest(script=script, model=model), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                routing = root / '.claude/harness'
                routing.mkdir(parents=True)
                for name in ('effort.py', 'effort-ledger.json'):
                    (routing / name).write_bytes((BASE / name).read_bytes())
                cli = root / 'claude'
                cli.write_text('#!/usr/bin/env python3\nimport json, os, sys\n'
                               'from pathlib import Path\n'
                               'Path(os.environ["CALL_ARGS"]).write_text(json.dumps(sys.argv[1:]))\n'
                               'print("## Intent\\n" + "question " * 120)\n')
                cli.chmod(0o755)
                env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                           CALL_ARGS=str(root / 'args.json'), RESEARCH_DIR=str(root / 'research'),
                           TASK_CONTEXT='effort routing check', MODEL=model, HOME=str(root))
                args = ['-p', '--', '--model', model, 'prompt'] if model else ['-p', 'prompt']
                if script == 'dive-grill-questions.sh':
                    args = ['entry=Entry point']
                subprocess.run(['bash', str(deploy.ROOT / 'harness/claude/scripts' / script), *args],
                               env=env, text=True, capture_output=True, check=True)
                actual = json.loads((root / 'args.json').read_text())
                tier = 'medium' if script == 'agent-impl.sh' else 'light'
                profile = deploy.effort.resolve_effort_profile(deploy.effort.load_effort_ledger(), 'claude', tier)
                self.assertEqual(actual[actual.index('--model') + 1], model or profile['model'])
                self.assertEqual(actual[actual.index('--effort') + 1], profile['reasoning'])

    def test_fork_guard_checks_structure_not_model_names(self):
        guard_path = deploy.ROOT / 'harness/claude/hooks/block-fork-with-nested-agents.py'
        for tool_input, denied in [
            ({'subagent_type': 'fork', 'prompt': 'Summarize the Sonnet and Haiku incident.'}, False),
            ({'subagent_type': 'fork', 'prompt': 'Spawn subagents for the checks.'}, True),
            ({'subagent_type': 'fork', 'prompt': 'Summarize the input.', 'model': 'requested-model'}, True),
            ({'subagent_type': 'general-purpose', 'prompt': 'Spawn subagents for the checks.'}, False),
        ]:
            with self.subTest(tool_input=tool_input):
                result = subprocess.run(['python3', str(guard_path)],
                                        input=json.dumps({'tool_input': tool_input}), text=True,
                                        capture_output=True, check=True)
                self.assertEqual(bool(result.stdout), denied)
                if denied:
                    self.assertEqual(json.loads(result.stdout)['hookSpecificOutput']['permissionDecision'], 'deny')


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

    def test_opencode_settings_preserve_other_provider_fields(self):
        existing = {'providers': {'acme': {'name': 'Acme'}, 'openai': {'headers': {'X-Team': 'test'}}},
                    'plugins': ['personal-plugin'], 'theme': 'personal'}
        managed = {'model': 'openai/gpt-6.1-sol', 'providers': {'openai': {'models': {'gpt-6.1-sol': {'settings': {'reasoningEffort': 'medium'}}}}},
                   'plugins': ['session-pins']}
        result = deploy.merge_settings(existing, managed)
        self.assertEqual(result['providers']['acme'], existing['providers']['acme'])
        self.assertEqual(result['providers']['openai']['headers'], {'X-Team': 'test'})
        self.assertEqual(result['providers']['openai']['models'], managed['providers']['openai']['models'])
        self.assertEqual(result['plugins'], ['personal-plugin', 'session-pins'])
        self.assertEqual(deploy.merge_settings(result, managed), result)
        self.assertEqual(result['theme'], 'personal')
        self.assertEqual(deploy.merge_settings(result, {'plugins': []})['plugins'], [])

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
    def test_runtime_manifests_protect_generated_files_and_allow_source(self):
        for directory in ('.config/opencode', '.cursor'):
            with self.subTest(directory=directory), tempfile.TemporaryDirectory() as temporary:
                home = Path(temporary)
                runtime = home / directory / 'agents/effort-light.md'
                manifest = home / directory / 'harness/installed.json'
                manifest.parent.mkdir(parents=True)
                manifest.write_text(json.dumps({'files': {str(runtime): {}}}))
                self.assertIsNotNone(guard.check({'tool_name': 'edit', 'tool_input': {'path': str(runtime)}}, home))
                self.assertIsNone(guard.check({'tool_name': 'read', 'tool_input': {'path': str(runtime)}}, home))
                self.assertIsNone(guard.check({'tool_name': 'edit', 'tool_input': {'path': str(BASE / 'commands/code.md')}}, home))

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
