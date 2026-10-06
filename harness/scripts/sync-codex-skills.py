#!/usr/bin/env python3
"""Expose local Claude and plugin skills to Codex through a GNU Stow package.

Usage: sync-codex-skills.py [--home PATH] [--package-dir PATH] [--dry-run]
Skill contents stay at their source; only generated, owned symlinks are replaced.
"""

import argparse
import json
import os
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, default=Path.home())
    parser.add_argument("--package-dir", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    home = args.home.resolve()
    package = (args.package_dir or root / "harness/codex").resolve()
    target = home / ".agents"
    manifest = package / ".skill-links.json"
    previous = json.loads(manifest.read_text()) if manifest.exists() else {}

    sources = {}
    # Repository sources win over their installed Claude copies.
    for parent in (root / "harness/claude/skills", home / ".claude/skills"):
        for skill in sorted(parent.glob("*/SKILL.md")):
            if skill.is_file():
                sources.setdefault(skill.parent.name, str(skill.parent.resolve()))
    for skill in sorted((root / "harness/plugins").glob("*/skills/*/SKILL.md")):
        name = skill.parent.name
        if name in sources and sources[name] != str(skill.parent.resolve()):
            name = f"{skill.parents[2].name}-{name}"
        sources.setdefault(name, str(skill.parent.resolve()))

    # Harness-specific entry points override shared Claude sources by skill name.
    for skill in sorted((root / "harness/codex-skills").glob("*/SKILL.md")):
        sources[skill.parent.name] = str(skill.parent.resolve())

    selected = {}
    preserved = []
    for name, source in sources.items():
        installed = target / "skills" / name
        owned_link = package / "skills" / name
        ours = (name in previous and installed.is_symlink()
                and installed.resolve() == owned_link.resolve())
        if os.path.lexists(installed) and not ours:
            preserved.append(name)
        else:
            selected[name] = source
    print(f"{len(selected)} skills to link; {len(preserved)} existing Codex entries preserved")
    if preserved:
        print("Preserved: " + ", ".join(preserved))
    if args.dry_run:
        return

    # Preflight ownership before GNU Stow or filesystem changes.
    for path in (package / "skills").glob("*"):
        if path.name not in previous or not path.is_symlink():
            raise SystemExit(f"Refusing to replace unmanaged package entry: {path}")
    package.mkdir(parents=True, exist_ok=True)
    (package / ".stow-local-ignore").write_text(r"\.skill-links\.json" + "\n")
    target.mkdir(parents=True, exist_ok=True)
    (target / "skills").mkdir(exist_ok=True)
    stow = ["stow", "--no-folding", f"--dir={package.parent}", f"--target={target}"]
    if previous:
        subprocess.run(stow + ["--delete", package.name], check=True)
    skills = package / "skills"
    skills.mkdir(exist_ok=True)
    for name in previous:
        link = skills / name
        if link.is_symlink():
            link.unlink()
    for name, source in selected.items():
        (skills / name).symlink_to(os.path.relpath(source, skills), target_is_directory=True)
    manifest.write_text(json.dumps(selected, indent=2, sort_keys=True) + "\n")
    subprocess.run(stow + ["--restow", package.name], check=True)
    missing = [name for name in selected if not (target / "skills" / name / "SKILL.md").is_file()]
    if missing:
        raise SystemExit("Unresolved installed skills: " + ", ".join(missing))
    print(f"Linked and verified {len(selected)} skills in {target / 'skills'}")


if __name__ == "__main__":
    main()
