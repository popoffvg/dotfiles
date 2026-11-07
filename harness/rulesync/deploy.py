#!/usr/bin/env python3
"""Import repository sources with Rulesync and publish owned runtime files to HOME.

--home provides an isolated installation for verification. No generated file is
written into the repository. Unmanaged collisions and modified owned files stop
publication before any runtime file is changed.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'harness/rulesync'
CACHE = Path(os.environ.get('XDG_CACHE_HOME', str(Path.home() / '.cache'))) / 'dotfiles-rulesync'
CONFIG = json.loads((HERE / 'config.json').read_text())
if CONFIG['sourceFormat'] != 'claude-native':
    raise RuntimeError('Unknown Rulesync source format')
TARGETS = {'claude': '.claude', 'codex': '.codex', 'pi': '.pi/agent'}
SKILL_OUTPUTS = {'claude': '.claude/skills', 'codex': '.agents/skills', 'pi': '.pi/skills'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def run_rulesync(args, cwd):
    result = subprocess.run([str(HERE / 'rulesync.sh'), *args, '--silent'], cwd=cwd,
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(f'Rulesync {args[0]} failed:\n{result.stderr}\n{result.stdout[-3000:]}')


def copy_tree(src, dst):
    if src.exists():
        shutil.copytree(src, dst, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.DS_Store', '.git', 'node_modules'))


def normalize(path):
    subprocess.run(['node', str(HERE / 'normalize.mjs'), str(CACHE), str(path)], check=True)


def prepare_skills(source, canonical):
    result = subprocess.run(['node', str(HERE / 'invocation.mjs'), str(CACHE), str(source), str(canonical)],
                            check=True, text=True, stdout=subprocess.PIPE)
    return json.loads(result.stdout)


def worker_base(directory, target):
    return Path(directory) / ('skills' if target == 'claude' else 'harness/skills')


def install_aliases(install, home):
    for target, directory in TARGETS.items():
        plugin = home / directory / 'harness/plugins/wm'
        guide = plugin / 'codex-skills/wm/references/runtime.md'
        runtime = ('Use native Claude tools and plugin lifecycle hooks.' if target == 'claude' else
                   f'Read `{guide}` for path resolution and explicit lifecycle checks. ' +
                   ('Translate its tool instructions to Pi read, edit, write, bash, and available subagents; '
                    'Claude and Codex tool names mean their Pi equivalents. '
                    'When independent agents are unavailable, run sequentially and disclose that limit.'
                    if target == 'pi' else 'Use its Codex tool adapters.'))
        for name in CONFIG['publicAliases']:
            source = HERE / 'commands' / (name + '.md')
            text = source.read_text().replace('{{PLUGIN_ROOT}}', str(plugin)).replace('{{RUNTIME}}', runtime)
            text = text.replace('{{ARGUMENTS}}', 'the arguments supplied with this skill invocation' if target == 'codex' else '$ARGUMENTS')
            if target == 'codex':
                text = text.replace('disable-model-invocation: true\n', '')
            relative = (Path(directory) / 'skills' / name / 'SKILL.md' if target == 'codex' else
                        Path(directory) / ('commands' if target == 'claude' else 'prompts') / (name + '.md'))
            install.add(relative, text.encode(), source)
            if target == 'codex':
                install.add(relative.parent / 'agents/openai.yaml', b'policy:\n  allow_implicit_invocation: false\n', source)


class Installation:
    def __init__(self, home):
        self.home = home
        self.files = {}
        self.links = {}
        self.sources = {}
        self.previous = {}
        self.shared = set()
        for directory in TARGETS.values():
            manifest = home / directory / 'harness/installed.json'
            if manifest.is_file():
                self.previous.update(json.loads(manifest.read_text()).get('files', {}))

    def add(self, dest, data, source, mode=0o644):
        dest = self.home / dest
        if dest in self.files and self.files[dest][0] != data:
            raise RuntimeError(f'Two sources produce {dest}')
        self.files[dest] = (data, mode)
        self.sources[dest] = str(source)

    def tree(self, src, dest, source):
        if not src.exists():
            return
        for path in sorted(src.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.name != '.DS_Store':
                relative = path.relative_to(src)
                origin = source / relative
                if relative.parts[0] == 'internal-commands' and not origin.exists():
                    origin = source / 'commands' / Path(*relative.parts[1:])
                if path.name == 'openai.yaml' and not origin.exists() and (origin.parent.parent / 'SKILL.md').exists():
                    origin = origin.parent.parent / 'SKILL.md'
                if path.suffix == '.toml' and not origin.exists() and origin.with_suffix('.md').exists():
                    origin = origin.with_suffix('.md')
                self.add(Path(dest) / relative, path.read_bytes(), origin,
                         path.stat().st_mode & 0o777)

    def link(self, dest, target, source):
        dest = self.home / dest
        self.links[dest] = self.home / target
        self.sources[dest] = str(source)

    def preflight(self):
        problems = []
        for path in self.files.keys() | self.links.keys():
            if not os.path.lexists(path):
                continue
            if path in self.shared:
                continue
            old = self.previous.get(str(path))
            # Existing Stow links owned by this repo can be replaced by real copies.
            if path.resolve().is_relative_to(ROOT):
                continue
            source = Path(self.sources[path])
            if path.is_file() and source.is_file() and path.read_bytes() == source.read_bytes():
                continue
            if old:
                if 'link' in old:
                    unchanged = path.is_symlink() and os.readlink(path) == old['link']
                else:
                    unchanged = path.is_file() and digest(path.read_bytes()) == old['sha256']
                if unchanged:
                    continue
                # Already equals the desired content (e.g. a previous interrupted publish).
            if path in self.files and path.is_file() and path.read_bytes() == self.files[path][0]:
                continue
            if path in self.links and path.is_symlink() and path.resolve() == self.links[path].resolve():
                continue
            problems.append(str(path))
        if problems:
            raise RuntimeError('Refusing to overwrite unmanaged or locally edited files:\n' + '\n'.join(problems))
        for name, old in self.previous.items():
            path = Path(name)
            if path in self.files or path in self.links or not os.path.lexists(path):
                continue
            unchanged = (path.is_symlink() and os.readlink(path) == old.get('link')) if 'link' in old else (
                path.is_file() and digest(path.read_bytes()) == old.get('sha256'))
            if not unchanged:
                raise RuntimeError(f'Retired installed file was edited; preserve and reconcile it: {path}')

    def publish(self):
        self.preflight()
        # Stow may link a whole skill directory. Detach that ancestor before
        # creating a temporary output file, otherwise even atomic writes hit git.
        ancestors = set()
        for path in self.files.keys() | self.links.keys():
            for candidate in path.parents:
                if candidate == self.home:
                    break
                if candidate.is_symlink():
                    ancestors.add(candidate)
        for path in sorted(ancestors, key=lambda p: len(p.parts)):
            if not path.is_symlink():
                continue
            target = path.resolve()
            with tempfile.TemporaryDirectory(dir=path.parent) as temporary:
                detached = Path(temporary) / 'copy'
                if target.is_dir():
                    copy_tree(target, detached)
                else:
                    shutil.copy2(target, detached)
                path.unlink()
                detached.replace(path)
        state = {}
        for path, (data, mode) in self.files.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            # Replace the link itself; never write through a Stow link into source.
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
                handle.write(data)
                temporary = Path(handle.name)
            temporary.chmod(mode)
            temporary.replace(path)
            state[str(path)] = {'source': self.sources[path], 'sha256': digest(data)}
        for path, target in self.links.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            if os.path.lexists(path):
                path.unlink()
            relative = os.path.relpath(target, path.parent)
            path.symlink_to(relative, target_is_directory=True)
            state[str(path)] = {'source': self.sources[path], 'link': relative}
        # Retract only previously owned, unchanged files. Never sweep a skills directory.
        for name, old in self.previous.items():
            path = Path(name)
            if name in state or not os.path.lexists(path):
                continue
            unchanged = (path.is_symlink() and os.readlink(path) == old.get('link')) if 'link' in old else (
                path.is_file() and digest(path.read_bytes()) == old.get('sha256'))
            if not unchanged:
                raise RuntimeError(f'Retired installed file was edited; preserve and reconcile it: {path}')
            path.unlink()
        for directory in TARGETS.values():
            base = self.home / directory
            manifest = base / 'harness/installed.json'
            manifest.parent.mkdir(parents=True, exist_ok=True)
            own = {p: v for p, v in state.items() if Path(p).is_relative_to(base)}
            manifest.write_text(json.dumps({'version': 1, 'source': str(ROOT), 'files': own}, indent=2) + '\n')
        print(f'Installed {len(self.files)} files and {len(self.links)} skill links with Rulesync.')

    def check(self):
        failures = []
        for name in self.previous:
            path = Path(name)
            if path not in self.files and path not in self.links and os.path.lexists(path):
                failures.append(str(path))
        for path, (data, mode) in self.files.items():
            if path.is_symlink() or not path.is_file() or path.read_bytes() != data or (path.stat().st_mode & 0o111) != (mode & 0o111):
                failures.append(str(path))
        for path, target in self.links.items():
            if not path.is_symlink() or path.resolve() != target.resolve():
                failures.append(str(path))
        if failures:
            raise RuntimeError('Installation differs from source:\n' + '\n'.join(failures))
        print(f'Verified {len(self.files)} generated files and {len(self.links)} skill links.')


def retire_native_wm(home):
    """The private library supersedes WM's native plugin skill exports."""
    import tomllib
    config = home / '.codex/config.toml'
    if not config.is_file():
        return
    plugins = tomllib.loads(config.read_text()).get('plugins', {})
    if 'wm@dotfiles-codex' in plugins:
        subprocess.run(['codex', 'plugin', 'remove', 'wm@dotfiles-codex', '--json'],
                       env=dict(os.environ, CODEX_HOME=str(home / '.codex')), check=True,
                       stdout=subprocess.DEVNULL)
        print('Retired native WM plugin registration; the three aliases use the private WM library.')


def retire_legacy_links(home):
    """Remove only old Codex links whose source was migrated from this checkout."""
    manifest = ROOT / 'harness/codex/.skill-links.json'
    if not manifest.exists():
        return
    removed = 0
    for name, source in json.loads(manifest.read_text()).items():
        source = Path(source)
        installed = home / '.agents/skills' / name
        if source.is_relative_to(ROOT) and installed.is_symlink() and installed.resolve() == source.resolve():
            installed.unlink()
            removed += 1
    if removed:
        print(f'Retired {removed} legacy repository skill links from ~/.agents; external skills preserved.')


def build(home, stage):
    install = Installation(home)
    raw = stage / 'loose'
    copy_tree(ROOT / CONFIG['loose'], raw / '.claude')
    copy_tree(ROOT / CONFIG['projectSkills'], raw / '.claude/skills')
    copy_tree(ROOT / CONFIG['skills'], raw / '.claude/skills')
    normalize(raw / '.claude')
    run_rulesync(['import', '--targets', 'claudecode', '--features', 'skills,commands,subagents',
                  '--output-root', str(raw)], raw)
    loose_catalog = prepare_skills(raw / '.claude/skills', raw / '.rulesync/skills')
    catalogs = {target: [] for target in TARGETS}
    generated = stage / 'loose-output'
    generated.mkdir()
    run_rulesync(['generate', '--targets', 'claudecode,codexcli,pi', '--features', 'skills',
                  '--input-roots', str(raw / '.rulesync'), '--output-roots', str(generated)], raw)
    run_rulesync(['generate', '--targets', 'claudecode,codexcli', '--features', 'subagents',
                  '--input-roots', str(raw / '.rulesync'), '--output-roots', str(generated)], raw)
    run_rulesync(['generate', '--targets', 'claudecode', '--features', 'commands',
                  '--input-roots', str(raw / '.rulesync'), '--output-roots', str(generated)], raw)
    for target, directory in TARGETS.items():
        base = worker_base(directory, target)
        install.tree(generated / SKILL_OUTPUTS[target], base, ROOT / 'harness/claude/skills')
        catalogs[target].extend((entry, home / base / entry['directory'] / 'SKILL.md') for entry in loose_catalog)
        if target == 'claude':
            catalogs[target].extend(({'name': 'command:' + path.stem, 'description': 'Legacy command reference; read when requested or named by a route.', 'automatic': False},
                                     home / directory / 'harness/internal-commands' / path.relative_to(generated / '.claude/commands'))
                                    for path in (generated / '.claude/commands').rglob('*.md'))
        # Source overlays retain their actual authoring paths in the ownership map.
        for dest in list(install.sources):
            skill_base = home / base
            if dest.is_relative_to(skill_base):
                relative = dest.relative_to(skill_base)
                for overlay in (ROOT / CONFIG['projectSkills'], ROOT / CONFIG['skills']):
                    if (overlay / relative).is_file():
                        install.sources[dest] = str(overlay / relative)
        install.add(Path(directory) / 'harness/guard.py', (HERE / 'guard.py').read_bytes(), HERE / 'guard.py', 0o755)

    # Nonportable personal configuration and helper assets remain native sources.
    # Rulesync owns supported skills; this publisher installs the companion files.
    for child in (ROOT / 'harness/claude').iterdir():
        if child.name in {'skills', 'agents', 'commands', 'settings.json', '.stow-local-ignore', 'settings.json.bak', 'settings.json.bak-skilltrace'}:
            continue
        if child.is_dir():
            install.tree(child, Path('.claude') / child.name, child)
        elif child.is_file():
            install.add(Path('.claude') / child.name, child.read_bytes(), child, child.stat().st_mode & 0o777)
    install.tree(generated / '.claude/agents', '.claude/agents', ROOT / 'harness/claude/agents')
    install.tree(generated / '.claude/commands', '.claude/harness/internal-commands', ROOT / 'harness/claude/commands')
    install.tree(generated / '.codex/agents', '.codex/agents', ROOT / 'harness/claude/agents')

    plugin_entries = []
    codex_entries = []
    for plugin in sorted((ROOT / CONFIG['plugins']).iterdir()):
        if not (plugin / '.claude-plugin/plugin.json').is_file():
            continue
        work = stage / ('plugin-' + plugin.name)
        native = work / 'native'
        copy_tree(plugin, native)
        normalize(native)
        features = [feature for feature, path in [('skills', 'skills'), ('subagents', 'agents'), ('commands', 'commands'), ('hooks', 'hooks/hooks.json'), ('mcp', '.mcp.json')] if (native / path).exists()]
        if features:
            run_rulesync(['import', '--targets', 'claudecode-plugin', '--features', ','.join(features), '--output-root', str(native)], work)
        plugin_catalog = prepare_skills(native / 'skills', work / '.rulesync/skills')
        for target, directory in TARGETS.items():
            output = work / target
            copy_tree(native, output)
            if target != 'claude':
                # Codex also auto-discovers hooks/hooks.json in plugin bundles.
                # Shipping a Claude registration there would activate unported code.
                (output / 'hooks/hooks.json').unlink(missing_ok=True)
            if features:
                enabled = features if target == 'claude' else [f for f in features if f == 'skills' or (f == 'subagents' and target == 'codex')]
                if enabled:
                    run_rulesync(['generate', '--targets', {'claude': 'claudecode-plugin', 'codex': 'codexcli', 'pi': 'pi'}[target],
                                  '--features', ','.join(enabled), '--input-roots', str(work / '.rulesync'), '--output-roots', str(output)], work)
                if target != 'claude' and (output / SKILL_OUTPUTS[target]).exists():
                    shutil.rmtree(output / 'skills', ignore_errors=True)
                    shutil.move(str(output / SKILL_OUTPUTS[target]), output / 'skills')
            if target == 'codex' and (output / '.codex/agents').is_dir():
                # Expose generated native agents at Codex's actual discovery root.
                for agent in (output / '.codex/agents').glob('*.toml'):
                    import re
                    data = re.sub(r'^name = .*$', 'name = ' + json.dumps(f'{plugin.name}-{agent.stem}'), agent.read_text(), count=1, flags=re.M).encode()
                    install.add(Path(directory) / 'agents' / f'{plugin.name}-{agent.name}', data, plugin / 'agents' / (agent.stem + '.md'))
            # Top-level legacy commands are references, not public entry points.
            if (output / 'commands').is_dir():
                shutil.move(str(output / 'commands'), output / 'internal-commands')
            if target == 'pi' and (output / 'skills').is_dir():
                import re
                for skill in (output / 'skills').iterdir():
                    entry = skill / 'SKILL.md'
                    if entry.is_file():
                        entry.write_text(re.sub(r'^name:.*$', f'name: {plugin.name}-{skill.name}', entry.read_text(), count=1, flags=re.M))
            runtime = Path(directory) / 'harness/plugins' / plugin.name
            install.tree(output, runtime, plugin)
            for destination in list(install.sources):
                prefix = home / runtime / '.codex/agents'
                if destination.is_relative_to(prefix):
                    install.sources[destination] = str(plugin / 'agents' / (destination.stem + '.md'))
            catalogs[target].extend((dict(entry, name=plugin.name + ':' + entry['name']), home / runtime / 'skills' / entry['directory'] / 'SKILL.md') for entry in plugin_catalog)
            catalogs[target].extend(({'name': plugin.name + ':' + path.stem, 'description': 'Legacy command reference; read when requested or named by a route.', 'automatic': False},
                                     home / runtime / 'internal-commands' / path.relative_to(output / 'internal-commands'))
                                    for path in (output / 'internal-commands').rglob('*.md'))
        metadata = json.loads((plugin / '.claude-plugin/plugin.json').read_text())
        plugin_entries.append({'name': plugin.name, 'source': './plugins/' + plugin.name, 'version': metadata['version'], 'description': metadata.get('description', '')})
        if (plugin / '.codex-plugin/plugin.json').exists():
            codex_entries.append({'name': plugin.name, 'source': {'source': 'local', 'path': './plugins/' + plugin.name}, 'policy': {'installation': 'AVAILABLE', 'authentication': 'ON_INSTALL'}})
    install.add(Path('.claude/harness/.claude-plugin/marketplace.json'), json.dumps({'name': 'local-plugins', 'owner': {'name': 'popoffvg'}, 'plugins': plugin_entries}, indent=2).encode() + b'\n', HERE / 'config.json')
    install.add(Path('.codex/harness/.agents/plugins/marketplace.json'), json.dumps({'name': 'dotfiles-codex', 'plugins': codex_entries}, indent=2).encode() + b'\n', HERE / 'config.json')

    settings = json.loads((ROOT / 'harness/claude/settings.json').read_text())
    settings['extraKnownMarketplaces']['local-plugins']['source']['path'] = str(home / '.claude/harness')
    settings.setdefault('hooks', {}).setdefault('PreToolUse', []).append({'matcher': 'Edit|Write|MultiEdit|Bash', 'hooks': [{'type': 'command', 'command': f'python3 "{home}/.claude/harness/guard.py" --home "{home}" --protocol claude'}]})
    native_settings = stage / 'personal-settings'
    (native_settings / '.claude').mkdir(parents=True)
    (native_settings / '.claude/settings.json').write_text(json.dumps(settings))
    run_rulesync(['import', '--targets', 'claudecode', '--features', 'hooks', '--output-root', str(native_settings)], native_settings)
    # Start with all personal settings; Rulesync owns only the hook component.
    (generated / '.claude/settings.json').write_text(json.dumps(settings))
    run_rulesync(['generate', '--targets', 'claudecode', '--features', 'hooks', '--input-roots', str(native_settings / '.rulesync'), '--output-roots', str(generated)], native_settings)
    install.add(Path('.claude/settings.json'), (generated / '.claude/settings.json').read_bytes(), ROOT / 'harness/claude/settings.json')

    # Only the new maintenance guard is portable. Existing WM lifecycle scripts
    # retain their native registration and Codex's explicit runtime contract.
    hooks = stage / 'maintenance'
    hooks.mkdir()
    command = f'python3 "{home}/.codex/harness/guard.py" --home "{home}" --protocol codex'
    (hooks / 'hooks.json').write_text(json.dumps({'version': 1, 'hooks': {'preToolUse': [{'command': command}]}}))
    out = stage / 'maintenance-output'
    out.mkdir()
    run_rulesync(['generate', '--targets', 'codexcli', '--features', 'hooks', '--input-roots', str(hooks), '--output-roots', str(out)], stage)
    # Seed shared hook configuration so Rulesync preserves third-party registrations.
    # config.toml belongs to Codex and is deliberately not published by this task.
    existing_hooks = home / '.codex/hooks.json'
    if existing_hooks.is_file():
        (out / '.codex').mkdir(parents=True, exist_ok=True)
        shutil.copy2(existing_hooks, out / '.codex/hooks.json')
        run_rulesync(['generate', '--targets', 'codexcli', '--features', 'hooks', '--input-roots', str(hooks), '--output-roots', str(out)], stage)
    install.add(Path('.codex/hooks.json'), (out / '.codex/hooks.json').read_bytes(), HERE / 'guard.py')
    install.shared.add(home / '.codex/hooks.json')
    install.add(Path('.pi/agent/extensions/harness-source-guard.ts'), (HERE / 'pi-guard.ts').read_bytes().replace(b'__GUARD__', str(home / '.pi/agent/harness/guard.py').encode()).replace(b'__HOME__', str(home).encode()), HERE / 'pi-guard.ts')

    for path in (ROOT / 'harness/pi').iterdir():
        if path.name == '.stow-local-ignore':
            continue
        if path.is_file():
            data = path.read_bytes()
            if path.name == 'claude-plugins.json':
                config = json.loads(data)
                config['marketplaces'].pop('local-plugins', None)
                # These plugins are deployed privately above; prevent the bridge from
                # re-exporting their commands and skills into Pi discovery.
                config['plugins'] = {name: value for name, value in config['plugins'].items()
                                     if not name.endswith('@local-plugins')}
                data = json.dumps(config, indent=2).encode() + b'\n'
            elif path.name == 'mcp.json' and (home / '.pi/agent/mcp.json').is_file():
                config = json.loads((home / '.pi/agent/mcp.json').read_text())
                for key, value in json.loads(data).items():
                    if isinstance(value, dict):
                        config.setdefault(key, {}).update(value)
                    else:
                        config[key] = value
                data = json.dumps(config, indent=2).encode() + b'\n'
                install.shared.add(home / '.pi/agent/mcp.json')
            install.add(Path('.pi/agent') / path.name, data, path)
        elif path.is_dir():
            install.tree(path, Path('.pi/agent') / path.name, path)
    # A Codex-specific loose override remains selected over its shared skill.
    for skill in (ROOT / 'harness/codex-skills').iterdir():
        for file in skill.rglob('*'):
            if file.is_file():
                data = file.read_bytes()
                if file.name == 'SKILL.md':
                    data = data.replace(b'../../claude/skills/' + skill.name.encode() + b'/', b'')
                relative = Path('.codex/harness/skills') / skill.name / file.relative_to(skill)
                install.files.pop(home / relative, None)
                install.add(relative, data, file)
    for target, directory in TARGETS.items():
        base = worker_base(directory, target)
        index = home / directory / 'harness/skill-index.md'
        rows = ['# Internal harness skills', '',
                'Read the matching skill file before following its instructions. Resolve supporting files relative to that file.',
                'Automatic workers may be selected by description. Explicit workers require a user request or a route that calls them.', '',
                '| Skill | Selection | When to use / file |', '|---|---|---|']
        for entry, path in sorted(catalogs[target], key=lambda pair: pair[0]['name']):
            description = str(entry['description']).replace('\n', ' ').replace('|', r'\|')
            rows.append(f"| {entry['name']} | {'automatic' if entry['automatic'] else 'explicit'} | {description} — [{entry['name']}]({path}) |")
        install.add(Path(directory) / 'harness/skill-index.md', ('\n'.join(rows) + '\n').encode(), HERE / 'config.json')
        discovery = (f'Internal skills: read {index} to select relevant workers for each task, then read their files. '
                     'Workers outside native skill discovery rely on this index for model selection. '
                     if target != 'claude' else
                     f'Internal skill and legacy command references can be read from {index}; load their files when a route names them. ')
        instruction = ('\n<!-- dotfiles-harness:start -->\n' + discovery +
                       f'Before changing a personal skill, plugin, hook, or harness configuration, read {home / base / "harness-maintain/SKILL.md"}. '
                       'Edit the repository source recorded in the runtime harness/installed.json; run mise run harness:sync to regenerate installed copies.\n'
                       '<!-- dotfiles-harness:end -->\n')
        relative = Path(directory) / ('CLAUDE.md' if target == 'claude' else 'AGENTS.md')
        destination = home / relative
        if destination in install.files:
            content = install.files[destination][0].decode()
        else:
            content = destination.read_text() if destination.is_file() else ''
            install.shared.add(destination)
        import re
        content = re.sub(r'\n?<!-- dotfiles-harness:start -->.*?<!-- dotfiles-harness:end -->\n?', '', content, flags=re.S)
        # These are scoped instructions, not a replacement for existing personal rules.
        install.files.pop(destination, None)
        install.add(relative, (content.rstrip() + '\n' + instruction).encode(), HERE / 'skills/harness-maintain/SKILL.md')
    install_aliases(install, home)
    return install


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', type=Path, default=Path.home())
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--plan', action='store_true', help='Generate and preflight without installing')
    args = parser.parse_args()
    home = args.home.expanduser().absolute()
    if home == ROOT or home.is_relative_to(ROOT):
        raise SystemExit('Runtime output must be outside the dotfiles repository.')
    CACHE.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(HERE / 'rulesync.sh'), '--version'], check=True, stdout=subprocess.DEVNULL)
    with tempfile.TemporaryDirectory(prefix='build-', dir=CACHE) as temporary:
        install = build(home, Path(temporary))
        if args.check:
            install.check()
        elif args.plan:
            install.preflight()
            print(f'Preflight passed: {len(install.files)} files, {len(install.links)} links; no runtime changes.')
        else:
            install.publish()
            retire_legacy_links(home)
            retire_native_wm(home)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
