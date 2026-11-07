#!/usr/bin/env python3
"""Reject agent edits to installed harness copies; edit their repository source."""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import sys


def normalized(path, cwd):
    return Path(os.path.abspath(os.path.expanduser(str(Path(cwd) / path))))


def protected_paths(home):
    paths = []
    for root in (home / '.claude', home / '.codex', home / '.pi/agent'):
        manifest = root / 'harness/installed.json'
        paths.append(str(manifest))
        if manifest.is_file():
            paths.extend(json.loads(manifest.read_text()).get('files', {}))
    return {value for p in paths for value in (Path(p), Path(p).resolve())}


def check(payload, home):
    tool = str(payload.get('tool_name') or payload.get('toolName') or '').lower()
    if tool in {'read', 'read_file', 'read_text_file', 'list_files', 'glob', 'grep'}:
        return None
    cwd = payload.get('cwd') or str(Path.cwd())
    args = payload.get('tool_input') or payload.get('input') or {}
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except ValueError:
            args = {'patch': args}
    candidates = [args[k] for k in ('file_path', 'path', 'filename') if isinstance(args.get(k), str)]
    patch = args.get('patch') or args.get('input') or args.get('command') or args.get('cmd') or ''
    is_patch = isinstance(patch, str) and patch.lstrip().startswith('*** Begin Patch')
    if isinstance(patch, str):
        candidates += re.findall(r'^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$', patch, re.M)
    protected = protected_paths(home)
    for value in candidates:
        path = normalized(value, cwd)
        # Resolve parent links, but keep a symlink entry's own name for ownership.
        variants = {path, path.resolve(), path.parent.resolve() / path.name}
        caches = (home / '.claude/plugins/cache/local-plugins', home / '.codex/plugins/cache/dotfiles-codex')
        if variants & protected or any(p.is_relative_to(path) for p in protected) or any(path.is_relative_to(cache) for cache in caches):
            return f'Generated harness file: {path}. Load harness-maintain, edit the dotfiles source, then run mise run harness:sync. Source lookup: ~/.claude/harness/installed.json.'
    if is_patch:
        return None
    command = args.get('command') or args.get('cmd') or ''
    if isinstance(command, str) and re.search(r'(?:\b(?:rm|mv|cp|install|tee|touch|truncate)\b|\bsed\b[^\n]*-[a-z]*i|write_text|write_bytes|\*\*\* Update File:|>{1,2})', command):
        command = command.replace('${HOME}', str(home)).replace('$HOME', str(home)).replace('~/', str(home) + '/')
        for path in protected:
            if str(path) in command:
                return f'Command edits a generated harness file: {path}. Edit its dotfiles source and run mise run harness:sync.'
        try:
            tokens = shlex.split(command)
        except ValueError:
            tokens = []
        for token in tokens:
            if len(token) > 1 and token.startswith('/') and any(p.is_relative_to(Path(token)) for p in protected):
                return f'Command changes an installed harness directory: {token}. Edit source and deploy with mise run harness:sync.'
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', type=Path, default=Path.home())
    parser.add_argument('--protocol', choices=('claude', 'codex', 'pi'), default='claude')
    args = parser.parse_args()
    try:
        reason = check(json.load(sys.stdin), args.home)
    except (ValueError, OSError, TypeError) as exc:
        print(f'Harness source guard failed: {exc}', file=sys.stderr)
        return 2
    if reason:
        print(reason, file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
