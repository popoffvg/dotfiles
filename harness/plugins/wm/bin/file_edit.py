#!/usr/bin/env python3
import json
from pathlib import Path
import sys


def moved_file_content(tool):
    content = Path(tool['move_from']).read_text()
    cursor = 0
    for edit in tool['edits']:
        old, new = edit['old_string'], edit['new_string']
        position = content.find(old, cursor)
        if not old or position < 0:
            raise ValueError('WM cannot reconstruct the moved file.')
        content = content[:position] + new + content[position + len(old):]
        cursor = position + len(new)
    return content


if __name__ == '__main__':
    sys.stdout.write(moved_file_content(json.load(sys.stdin)['tool_input']))
