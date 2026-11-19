#!/usr/bin/env python3
import argparse
import os
from pathlib import Path


def create_wm_agents(project, notes):
    examples = Path(__file__).resolve().parents[1] / 'skills/arch/examples'
    rows = (
        (project, 'project-agents.md', True),
        (notes, 'notes-agents.md', False),
        (notes / 'todos', 'todos-agents.md', False),
    )
    for directory, template, append in rows:
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / 'AGENTS.md'
        legacy = directory / 'CLAUDE.md'
        content = path.read_text() if path.exists() else (
            legacy.read_text() if legacy.is_file() and legacy.read_text().strip() != '@AGENTS.md' else '')
        body = '\n'.join(line for line in (examples / template).read_text().splitlines() if not line.startswith('>')).strip()
        body = body.replace('<notes-dir>', os.path.relpath(notes, project))
        if not content:
            content = body + '\n'
        elif append and '<!-- wm-workflow:start -->' not in content:
            content = content.rstrip() + '\n\n' + body + '\n'
        if not path.exists() or path.read_text() != content:
            path.write_text(content)
        if not legacy.exists():
            legacy.write_text('@AGENTS.md\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('project', type=Path)
    parser.add_argument('notes', type=Path)
    args = parser.parse_args()
    create_wm_agents(args.project.absolute(), args.notes.absolute())


if __name__ == '__main__':
    main()
