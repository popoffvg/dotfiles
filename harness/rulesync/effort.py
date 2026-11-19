#!/usr/bin/env python3
"""Resolve an effort tier into native model and reasoning settings."""
import json
from pathlib import Path
import re
import subprocess
import sys
import tomllib


LEDGER = Path(__file__).with_name('effort-ledger.json')


def load_effort_ledger(path=LEDGER):
    ledger = json.loads(path.read_text())
    tiers = set(ledger['tiers'])
    if tiers != {'light', 'medium', 'heavy'}:
        raise ValueError('Effort ledger requires light, medium, and heavy tiers')
    for runtime, row in ledger['runtimes'].items():
        if set(row['profiles']) != tiers:
            raise ValueError(f'Effort profiles are incomplete: {runtime}')
        for tier, profile in row['profiles'].items():
            if not profile.get('model') or not profile.get('reasoning'):
                raise ValueError(f'Effort profile requires model and reasoning: {runtime}/{tier}')
        for templates in (list(row['fields'].values()), row['cli']):
            if not all('{' + key + '}' in ' '.join(templates) for key in ('model', 'reasoning')):
                raise ValueError(f'Effort adapter must apply model and reasoning: {runtime}')
        if len(row['cli']) % 2:
            raise ValueError(f'Effort CLI requires flag/value pairs: {runtime}')
    return ledger


def resolve_effort_profile(ledger, runtime, tier):
    tier = effort_tier_name(tier)
    row = ledger['runtimes'][runtime]
    profile = row['profiles'][tier]
    return {
        'model': profile['model'],
        'reasoning': profile['reasoning'],
        'selector': row['selector'].format(**profile),
        'fields': {key: value.format(**profile) for key, value in row['fields'].items()},
        'cli': [value.format(**profile) for value in row['cli']],
    }


def agent_frontmatter(text):
    return re.match(r'\A---\r?\n(.*?)\r?\n---(.*)\Z', text, re.S)


def source_effort_tier(text):
    header = agent_frontmatter(text)
    if header is None:
        return None
    match = re.search(r'^harness-effort:[ \t]*(\S+)[ \t]*$', header[1], re.M)
    return effort_tier_name(match[1]) if match else None


def effort_tier_name(value):
    value = value.strip().strip('"')
    if value.startswith('{') and value.endswith('}'):
        return value[1:-1]
    return value


def source_effort_variants(text):
    header = agent_frontmatter(text)
    match = re.search(r'^harness-variants:[ \t]*(.+)$', header[1], re.M) if header else None
    return [effort_tier_name(tier) for tier in match[1].strip('"').split(',')] if match else []


def render_effort_agent(text, runtime, profile, ledger):
    fields = profile['fields']
    if ledger['runtimes'][runtime]['agent_format'] == 'toml':
        metadata = tomllib.loads(text)
        metadata.update(fields)
        return ''.join(f'{key} = {toml_agent_value(value)}\n' for key, value in metadata.items())
    match = agent_frontmatter(text)
    if match is None:
        raise ValueError('Effort agent requires Markdown frontmatter')
    header, body = match.groups()
    header = re.sub(r'^(?:harness-effort|harness-variants|model|effort|thinking):.*\n?', '', header, flags=re.M)
    native = ''.join(f'{key}: {json.dumps(value)}\n' for key, value in fields.items())
    return '---\n' + native + header.lstrip('\n').rstrip('\n') + '\n---' + body


def toml_agent_value(value):
    if isinstance(value, dict):
        return '{' + ', '.join(f'{json.dumps(key)} = {toml_agent_value(item)}' for key, item in value.items()) + '}'
    if isinstance(value, list):
        return '[' + ', '.join(toml_agent_value(item) for item in value) + ']'
    return json.dumps(value, ensure_ascii=False)


def rename_effort_agent(text, name, suffix):
    return re.sub(r'^(name[ \t]*[:=][ \t]*)(.+)$',
                  lambda match: match[1] + json.dumps(name + '-' + suffix), text, count=1, flags=re.M)


def adapt_source_agent(text, name, row):
    match = agent_frontmatter(text)
    if match is None:
        raise ValueError('Source agent requires Markdown frontmatter')
    header, body = match.groups()
    header = re.sub(r'^name:.*$', 'name: ' + name, header, count=1, flags=re.M)
    tools = re.search(r'^tools:[ \t]*(.+)$', header, re.M)
    if tools is None:
        return '---\n' + header + '\n---' + body
    names = [value.strip() for value in tools[1].split(',')]
    aliases = row.get('tool_aliases')
    if aliases:
        mapped = ', '.join(dict.fromkeys(aliases.get(value, value) for value in names))
        header = header[:tools.start()] + 'tools: ' + mapped + header[tools.end():]
    if row.get('readonly_from_tools'):
        readonly = not {'Edit', 'Write', 'MultiEdit'}.intersection(names)
        header = re.sub(r'^tools:.*$', 'readonly: ' + str(readonly).lower(), header, count=1, flags=re.M)
    return '---\n' + header + '\n---' + body


def effort_cli_command(profile, command):
    overrides = set()
    for argument in command[1:]:
        if argument == '--':
            break
        overrides.add(argument.split('=', 1)[0])
    routed = []
    values = iter(profile['cli'])
    for flag in values:
        value = next(values)
        if flag not in overrides:
            routed.extend((flag, value))
    return [command[0], *routed, *command[1:]]


def main(args):
    if len(args) < 2:
        raise ValueError('Usage: effort.py RUNTIME TIER [-- COMMAND ARGS...]')
    ledger = load_effort_ledger()
    profile = resolve_effort_profile(ledger, args[0], args[1])
    if len(args) == 2:
        print(json.dumps(profile))
        return 0
    if len(args) < 4 or args[2] != '--':
        raise ValueError('Effort command requires -- before COMMAND')
    return subprocess.run(effort_cli_command(profile, args[3:])).returncode


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except (KeyError, ValueError, OSError) as error:
        print(f'Effort routing failed: {error}', file=sys.stderr)
        sys.exit(2)
