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
    if isinstance(command, str):
        command = command.replace('${HOME}', str(home)).replace('$HOME', str(home)).replace('~/', str(home) + '/')
        # Shell writes apply to their operands, not every path in the command.
        # A read of an installed file followed by a cache redirect is permitted.
        try:
            lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|<>\n")
            lexer.whitespace = ' \t\r'
            tokens = list(lexer)
        except ValueError:
            tokens = []
        writes = []
        segment = []
        for token in tokens + [';']:
            if token in {';', '&&', '||', '|', '&', '\n'}:
                if segment:
                    executable = Path(segment[0]).name
                    operands = [part for part in segment[1:] if not part.startswith('-')]
                    if executable in {'rm', 'mv', 'touch', 'truncate', 'tee'}:
                        writes.extend(operands)
                    elif executable in {'cp', 'install'} and operands:
                        writes.append(operands[-1])
                    elif executable == 'sed' and any(part == '--in-place' or part.startswith('--in-place=') or
                                                     re.match(r'^-[A-Za-z]*i', part) for part in segment[1:]):
                        writes.extend(operands)
                segment = []
            else:
                segment.append(token)
        for index, token in enumerate(tokens[:-1]):
            if token in {'>', '>>', '>|'}:
                writes.append(tokens[index + 1])
        for value in writes:
            path = normalized(value, cwd)
            if path in protected or path.resolve() in protected or any(p.is_relative_to(path) for p in protected):
                return f'Command edits an installed harness path: {path}. Edit source and deploy with mise run harness:sync.'
        if 'write_text' in command or 'write_bytes' in command:
            for path in protected:
                if str(path) in command:
                    return f'Command edits a generated harness file: {path}. Edit its dotfiles source and run mise run harness:sync.'
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
