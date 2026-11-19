import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import time


TOOL_NAMES = {
    'shell': 'Bash', 'bash': 'Bash', 'exec_command': 'Bash', 'Shell': 'Bash',
    'edit': 'Edit', 'write': 'Write', 'Delete': 'Write', 'read': 'Read',
    'read_file': 'Read', 'skill': 'Skill',
}
ADR_PATH = re.compile(r'''[^ "'`]*[/\\]adr[/\\]\d{4}-[^ "'`/\\]*\.md''')
CURSOR_CONTEXT_FIELDS = {
    'SessionStart': 'additional_context',
    'PostToolUse': 'additional_context',
    'PreCompact': 'user_message',
    'SessionEnd': None,
}


def patch_files(patch, cwd, after=False):
    changes = []
    sections = re.split(r'^\*\*\* (Add File|Update File|Delete File): (.+)\n', patch, flags=re.M)
    if len(sections) == 1:
        raise ValueError('WM patch input has no file operations.')
    for index in range(1, len(sections), 3):
        kind, name, body = sections[index:index + 3]
        path = Path(cwd, name).absolute()
        destination = re.search(r'^\*\*\* Move to: (.+)$', body, re.M)
        target = Path(cwd, destination[1]).absolute() if destination else path
        value = {'file_path': str(path), 'content': ''}
        if not after and kind == 'Add File':
            value['content'] = ''.join(line[1:] + '\n' for line in body.splitlines() if line.startswith('+'))
        if not after and kind == 'Update File':
            value = {'file_path': str(path), 'edits': patch_hunks(body)}
        changes.append(value)
        if target != path:
            moved = {'file_path': str(target), 'content': ''}
            if not after:
                moved = {'file_path': str(target), 'move_from': str(path), 'edits': value['edits']}
            changes.append(moved)
    return changes


def patch_hunks(body):
    edits = []
    for hunk in re.split(r'^@@.*\n', body, flags=re.M):
        lines = [line for line in hunk.splitlines() if line[:1] in (' ', '+', '-')]
        if lines:
            edits.append({
                'old_string': '\n'.join(line[1:] for line in lines if line[0] != '+'),
                'new_string': '\n'.join(line[1:] for line in lines if line[0] != '-'),
            })
    return edits


def tool_payloads(payload, after=False):
    name = payload.get('tool_name', '')
    value = payload.get('tool_input') or {}
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            value = {'patch': value}
    if not isinstance(value, dict):
        raise ValueError('WM tool input must be an object or patch text.')
    value = dict(value)
    response = payload.get('tool_response')
    if isinstance(response, str):
        try:
            response = json.loads(response)
        except ValueError:
            response = {'stdout': response}
        payload = dict(payload, tool_response=response)
    patch = value.get('patch') or value.get('patchText') or value.get('input') or value.get('command', '')
    if name in ('patch', 'apply_patch') and isinstance(patch, str):
        return [dict(payload, tool_name='Edit' if 'edits' in item and 'move_from' not in item else 'Write', tool_input=item)
                for item in patch_files(patch, payload['cwd'], after)]
    name = TOOL_NAMES.get(name, name)
    path = value.get('file_path') or value.get('filePath') or value.get('path') or value.get('target_file')
    if path:
        value['file_path'] = str(Path(payload['cwd'], path).absolute())
    if 'oldText' in value:
        value['old_string'] = value['oldText']
    if 'newText' in value:
        value['new_string'] = value['newText']
    if 'contents' in value:
        value['content'] = value['contents']
    if 'cmd' in value:
        value['command'] = value['cmd']
    if name == 'Read' and path and str(path).endswith('/SKILL.md') and '/wm/skills/' in str(path):
        value = {'skill': 'wm:' + Path(path).parent.name, 'args': ''}
        name = 'Skill'
    return [dict(payload, tool_name=name, tool_input=value)]


def hook_output(text):
    messages = []
    reason = ''
    remaining = text.strip()
    decoder = json.JSONDecoder()
    while remaining:
        try:
            value, end = decoder.raw_decode(remaining)
        except ValueError:
            line, _, remaining = remaining.partition('\n')
            messages.append(line)
            continue
        remaining = remaining[end:].lstrip()
        if not isinstance(value, dict):
            messages.append(str(value))
            continue
        specific = value.get('hookSpecificOutput') or {}
        if value.get('decision') == 'block' or specific.get('permissionDecision') == 'deny':
            reason = value.get('reason') or specific.get('permissionDecisionReason') or 'WM hook blocked the operation.'
        messages.extend(str(item) for item in (specific.get('additionalContext'), value.get('systemMessage')) if item)
    return reason, '\n'.join(messages)


def hook_budget(manifest, event):
    return sum(hook['timeout'] for group in manifest['hooks'].get(event, []) for hook in group['hooks']) / 1000


def matching_hooks(manifest, event, record):
    match = record.get('tool_name', '') if event in ('PreToolUse', 'PostToolUse') else record.get('source', '')
    for group in manifest['hooks'].get(event, []):
        pattern = group.get('matcher', '')
        if pattern in ('', '*') or re.search(pattern, match):
            yield from group['hooks']


def run_hook_command(root, hook, record, deadline):
    if hook['type'] != 'command':
        raise ValueError('WM hook adapter requires a command hook.')
    command = hook['command'].replace('${CLAUDE_PLUGIN_ROOT}', shlex.quote(str(root)))
    result = subprocess.run(
        command, shell=True, executable='/bin/bash', cwd=record['cwd'],
        env={**os.environ, 'CLAUDE_PLUGIN_ROOT': str(root)},
        input=json.dumps(record), text=True, capture_output=True,
        timeout=max(0.001, min(hook['timeout'] / 1000, deadline - time.monotonic())),
    )
    reason, text = hook_output(result.stdout)
    if result.returncode and not reason:
        raise RuntimeError(result.stderr.strip() or f'WM hook command failed: {command}')
    return reason, text


def run_wm_hooks(root, manifest, event, payload):
    messages = []
    deadline = time.monotonic() + hook_budget(manifest, event)
    records = tool_payloads(payload, event == 'PostToolUse') if event in ('PreToolUse', 'PostToolUse') else [payload]
    for record in records:
        for hook in matching_hooks(manifest, event, record):
            reason, text = run_hook_command(root, hook, record, deadline)
            if text:
                messages.append(text)
            if reason:
                return {'block': True, 'reason': reason, 'context': '\n'.join(messages)}
    return {'block': False, 'reason': '', 'context': '\n'.join(messages)}


def runtime_output(runtime, event, result):
    text = result['context']
    reason = result['reason']
    if runtime == 'cursor':
        if event == 'PreToolUse':
            return {'permission': 'deny' if result['block'] else 'allow', 'agent_message': reason}
        if event == 'Stop':
            return {'followup_message': reason} if result['block'] else {}
        if event == 'UserPromptSubmit':
            return {'continue': not result['block'], 'user_message': reason or text}
        field = CURSOR_CONTEXT_FIELDS[event]
        if text and field is None:
            print(text, file=sys.stderr)
        return {field: text} if text and field else {}
    if result['block']:
        return {'decision': 'block', 'reason': reason}
    if text:
        return {'hookSpecificOutput': {'hookEventName': event, 'additionalContext': text}}
    return {}


def record_wm_adrs(path, payload):
    paths = set()
    for record in tool_payloads(payload, after=True):
        value = record['tool_input']
        paths.update(ADR_PATH.findall(value.get('file_path', '')))
        if record['tool_name'] == 'Bash':
            paths.update(ADR_PATH.findall(value.get('command', '')))
    if paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('a') as stream:
            stream.write(json.dumps(sorted(str(Path(payload['cwd'], name).absolute()) for name in paths)) + '\n')


def session_wm_adrs(path):
    if not path.is_file():
        return []
    return sorted({name for line in path.read_text().splitlines() for name in json.loads(line)})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runtime', required=True, choices=('codex', 'cursor', 'opencode', 'pi'))
    parser.add_argument('--event', required=True)
    parser.add_argument('--root', required=True, type=Path)
    args = parser.parse_args()
    try:
        payload = json.load(sys.stdin)
        payload['cwd'] = payload.get('cwd') or (payload.get('workspace_roots') or [''])[0]
        if not payload['cwd']:
            raise ValueError('WM hook input has no working directory.')
        payload['session_id'] = payload.get('session_id') or payload.get('conversation_id', '')
        payload['hook_event_name'] = args.event
        manifest = json.loads((Path(__file__).parent / 'wm-hooks.json').read_text())
        key = hashlib.sha256(payload['session_id'].encode()).hexdigest()
        journal = Path(__file__).parent / 'wm-hook-sessions' / (args.runtime + '-' + key + '.jsonl')
        if args.event == 'PostToolUse' and payload['session_id']:
            record_wm_adrs(journal, payload)
        if args.event == 'SessionEnd':
            payload['adr_paths'] = session_wm_adrs(journal)
        command = re.match(r'^\s*(?:/code|\$code|/wm:code)(?:\s+(.*))?$', payload.get('prompt', ''), re.S)
        if args.event == 'UserPromptSubmit' and command:
            run_wm_hooks(args.root, manifest, 'PreToolUse', {
                **payload, 'tool_name': 'Skill', 'tool_input': {'skill': 'wm:code', 'args': command[1] or ''},
            })
        result = run_wm_hooks(args.root, manifest, args.event, payload)
        if args.event == 'SessionEnd':
            journal.unlink(missing_ok=True)
    except (ValueError, OSError, RuntimeError, TypeError, KeyError, subprocess.TimeoutExpired) as exc:
        result = {'block': args.event == 'PreToolUse', 'reason': f'WM hook adapter failed: {exc}', 'context': ''}
        if not result['block']:
            print(result['reason'], file=sys.stderr)
            return 1
    output = result if args.runtime in ('opencode', 'pi') else runtime_output(args.runtime, args.event, result)
    print(json.dumps(output))
    return 0


if __name__ == '__main__':
    sys.exit(main())
