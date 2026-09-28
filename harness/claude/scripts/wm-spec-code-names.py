#!/usr/bin/env python3
"""Diff the names a wm spec corpus uses against the names the code declares (Go, Rust, JS, TS)."""
import argparse
import difflib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

# (ast-grep language, file extensions, tree-sitter node kind, label, name field)
DECLARATIONS = [
    ("go", (".go",), "function_declaration", "func", "name"),
    ("go", (".go",), "method_declaration", "method", "name"),
    ("go", (".go",), "type_spec", "type", "name"),
    ("go", (".go",), "field_declaration", "field", "name"),
    ("go", (".go",), "method_elem", "method", "name"),
    ("go", (".go",), "const_spec", "const", "name"),
    ("go", (".go",), "var_spec", "var", "name"),
    ("rust", (".rs",), "function_item", "fn", "name"),
    ("rust", (".rs",), "function_signature_item", "fn", "name"),
    ("rust", (".rs",), "struct_item", "struct", "name"),
    ("rust", (".rs",), "enum_item", "enum", "name"),
    ("rust", (".rs",), "enum_variant", "variant", "name"),
    ("rust", (".rs",), "trait_item", "trait", "name"),
    ("rust", (".rs",), "type_item", "type", "name"),
    ("rust", (".rs",), "const_item", "const", "name"),
    ("rust", (".rs",), "static_item", "static", "name"),
    ("rust", (".rs",), "field_declaration", "field", "name"),
    ("rust", (".rs",), "mod_item", "mod", "name"),
    ("rust", (".rs",), "impl_item", "impl", "type"),
    ("rust", (".rs",), "macro_definition", "macro", "name"),
]
for _lang, _exts in (("typescript", (".ts", ".mts", ".cts")), ("tsx", (".tsx",))):
    DECLARATIONS += [
        (_lang, _exts, "function_declaration", "function", "name"),
        (_lang, _exts, "function_signature", "function", "name"),
        (_lang, _exts, "generator_function_declaration", "function", "name"),
        (_lang, _exts, "class_declaration", "class", "name"),
        (_lang, _exts, "abstract_class_declaration", "class", "name"),
        (_lang, _exts, "interface_declaration", "interface", "name"),
        (_lang, _exts, "type_alias_declaration", "type", "name"),
        (_lang, _exts, "enum_declaration", "enum", "name"),
        (_lang, _exts, "method_definition", "method", "name"),
        (_lang, _exts, "method_signature", "method", "name"),
        (_lang, _exts, "abstract_method_signature", "method", "name"),
        (_lang, _exts, "public_field_definition", "field", "name"),
        (_lang, _exts, "property_signature", "field", "name"),
        (_lang, _exts, "variable_declarator", "var", "name"),
    ]
DECLARATIONS += [
    ("javascript", (".js", ".jsx", ".mjs", ".cjs"), "function_declaration", "function", "name"),
    ("javascript", (".js", ".jsx", ".mjs", ".cjs"), "generator_function_declaration", "function", "name"),
    ("javascript", (".js", ".jsx", ".mjs", ".cjs"), "class_declaration", "class", "name"),
    ("javascript", (".js", ".jsx", ".mjs", ".cjs"), "method_definition", "method", "name"),
    ("javascript", (".js", ".jsx", ".mjs", ".cjs"), "field_definition", "field", "property"),
    ("javascript", (".js", ".jsx", ".mjs", ".cjs"), "variable_declarator", "var", "name"),
]

SCOPE_LABELS = {"type", "struct", "enum", "trait", "impl", "class", "interface", "mod"}
LOCAL_LABELS = {"var", "const"}
CALLABLE_LABELS = {"func", "fn", "function", "method"}
FENCE_LANGUAGES = {
    "go": ".go", "golang": ".go", "rust": ".rs", "rs": ".rs", "ts": ".ts", "typescript": ".ts",
    "tsx": ".tsx", "js": ".js", "javascript": ".js", "jsx": ".jsx",
}
FILE_EXTENSIONS = {ext for _, exts, *_ in DECLARATIONS for ext in exts} | {
    ".md", ".json", ".yaml", ".yml", ".toml", ".sh", ".py", ".txt", ".lock", ".mod", ".sum",
}
IDENTIFIER = re.compile(r"^[A-Za-z_]\w*(?:(?:\.|::)[A-Za-z_]\w*)*(?:\(\))?$")
INLINE_CODE = re.compile(r"`([^`\n]+)`")
FENCE = re.compile(r"^(\s*)```+\s*([\w+-]*)")
PATH_BULLET = re.compile(r"^\s*[-*]\s+`([^`]+\.\w+)`")
GO_RECEIVER = re.compile(r"^func\s*\(\s*\w*\s*\*?\s*(\w+)")
VISIBILITY = re.compile(r"^(?:export\s+(?:default\s+)?|pub(?:\([^)]*\))?\s+|declare\s+)+")

# State order is the report order: what needs a fix first.
STATES = [
    "variant", "missing", "scope-differs", "pending-remove", "pending-change", "planned", "landed", "match", "removed",
    "external", "word",
]
FAILING_STATES = {"variant", "missing", "scope-differs"}
HIDDEN_STATES = {"external", "word"}
SPEC_ROLES = {"+": "planned-add", "-": "planned-remove"}
SPEC_GLOBS = ("spec.md", "GLOSSARY.md", "todos/**/*.md", "thoughts/**/*.md")
MULTI_WORD = re.compile(r"_|[a-z][A-Z]|[A-Z]{2,}[a-z]")
IDENTIFIER_TOKEN = re.compile(r"[A-Za-z_]\w*")
SKIPPED_DIRS = {".git", "node_modules", "target", "vendor", "dist", "build"}


@dataclass
class Declaration:
    name: str
    kind: str
    scope: str
    path: str
    line: int
    signature: str


@dataclass
class CodeIndex:
    by_name: dict
    by_normal: dict
    scopes: set
    tokens: set


@dataclass
class SpecName:
    name: str
    scope: str
    role: str
    sources: list = field(default_factory=list)
    signature: str = ""


def ast_grep_binary():
    for candidate in ("ast-grep", "sg"):
        found = shutil.which(candidate)
        if found:
            return found
    sys.exit("wm-spec-code-names: ast-grep is not on PATH (brew install ast-grep)")


def inline_rules():
    documents = []
    for index, (language, _exts, node_kind, label, name_field) in enumerate(DECLARATIONS):
        documents.append(
            f"id: '{index}'\nlanguage: {language}\nrule:\n  kind: {node_kind}\n"
            f"  has:\n    field: {name_field}\n    pattern: $N\n"
        )
    return "\n---\n".join(documents)


def scan(paths, cwd):
    """Run ast-grep once over the paths; return declarations with scope and locals resolved."""
    command = [ast_grep_binary(), "scan", "--inline-rules", inline_rules(), "--json=stream", *paths]
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    if result.returncode not in (0, 1) and not result.stdout:
        sys.exit(f"wm-spec-code-names: ast-grep failed: {result.stderr.strip()}")
    matches_by_file = {}
    for raw in result.stdout.splitlines():
        match = json.loads(raw)
        row = DECLARATIONS[int(match["ruleId"])]
        name = match.get("metaVariables", {}).get("single", {}).get("N", {}).get("text")
        if not name:
            continue
        span = (match["range"]["byteOffset"]["start"], match["range"]["byteOffset"]["end"])
        matches_by_file.setdefault(match["file"], []).append((span, row[3], name, match))
    declarations = []
    for path, matches in matches_by_file.items():
        for span, label, name, match in matches:
            enclosing = [m for m in matches if m[0][0] <= span[0] and span[1] <= m[0][1] and m[0] != span]
            if label in LOCAL_LABELS and any(m[1] in CALLABLE_LABELS for m in enclosing):
                continue
            containers = [m for m in enclosing if m[1] in SCOPE_LABELS]
            scope = min(containers, key=lambda m: m[0][1] - m[0][0])[2] if containers else ""
            receiver = GO_RECEIVER.match(match["text"]) if label == "method" and path.endswith(".go") else None
            if receiver:
                scope = receiver.group(1)
            if label == "impl":
                continue
            declarations.append(
                Declaration(name, label, scope, path, match["range"]["start"]["line"] + 1, signature_of(match["text"]))
            )
    return declarations


def signature_of(text):
    """The first line of a declaration without its body, visibility, or trailing punctuation."""
    head = text.splitlines()[0].rstrip()
    if head.endswith("{"):
        head = head[:-1]
    elif head.endswith("}"):
        depth = 0
        for position in range(len(head) - 1, -1, -1):
            depth += {"}": 1, "{": -1}.get(head[position], 0)
            if depth == 0:
                head = head[:position]
                break
    head = VISIBILITY.sub("", head.strip())
    return re.sub(r"\s+", " ", head).rstrip(" ;,")


def is_code_name(text):
    if not IDENTIFIER.match(text):
        return False
    last = "." + text.rsplit(".", 1)[-1]
    return "." not in text or last not in FILE_EXTENSIONS


def split_qualified(text):
    parts = re.split(r"\.|::", text.removesuffix("()"))
    return parts[-1], parts[-2] if len(parts) > 1 else ""


def spec_files(notes_dir, todo, extra_globs):
    globs = [f"todos/TODO-{todo}.md", f"todos/TODO-{todo}.agent.md"] if todo else list(SPEC_GLOBS)
    found = {p for glob in globs + extra_globs for p in notes_dir.glob(glob) if "archived" not in p.parts}
    return sorted(found)


def read_spec(files, root):
    """Collect inline-code names and the fenced code of every spec file."""
    names = {}
    fences = []  # (extension, role, lines, spec line of each line, spec file)

    def add(text, role, source):
        name, scope = split_qualified(text)
        entry = names.setdefault((name, scope, role), SpecName(name, scope, role))
        entry.sources.append(source)

    for path in files:
        lines = path.read_text(errors="replace").splitlines()
        shown = path.relative_to(root) if path.is_relative_to(root) else path
        bullet_extension = ""
        index = 0
        while index < len(lines):
            line = lines[index]
            bullet = PATH_BULLET.match(line)
            if bullet:
                bullet_extension = Path(bullet.group(1)).suffix
            fence = FENCE.match(line)
            if not fence:
                for text in INLINE_CODE.findall(line):
                    if is_code_name(text.strip()):
                        add(text.strip(), "mention", f"{shown}:{index + 1}")
                index += 1
                continue
            info = fence.group(2).lower()
            body_start = index + 1
            index += 1
            while index < len(lines) and not lines[index].lstrip().startswith("```"):
                index += 1
            body = lines[body_start:index]
            numbers = list(range(body_start + 1, index + 1))
            index += 1
            if info == "diff" and bullet_extension:
                for sign, role in SPEC_ROLES.items():
                    kept = [(l[1:], n) for l, n in zip(body, numbers) if l.startswith(sign) and not l.startswith(sign * 3)]
                    fences.append((bullet_extension, role, [l for l, _ in kept], [n for _, n in kept], shown))
            elif info in FENCE_LANGUAGES:
                fences.append((FENCE_LANGUAGES[info], "mention", body, numbers, shown))
    with tempfile.TemporaryDirectory() as scratch:
        written = {}
        for number, (extension, role, body, spec_lines, shown) in enumerate(fences):
            if not body:
                continue
            snippet = Path(scratch) / f"fence{number}{extension}"
            snippet.write_text("\n".join(body) + "\n")
            written[str(snippet.resolve())] = (role, spec_lines, shown)
        if written:
            for decl in scan(list(written), scratch):
                role, spec_lines, shown = written[str((Path(scratch) / decl.path).resolve())]
                source = f"{shown}:{spec_lines[decl.line - 1]}"
                entry = names.setdefault((decl.name, decl.scope, role), SpecName(decl.name, decl.scope, role))
                entry.sources.append(source)
                entry.signature = entry.signature or decl.signature
    changed = {(name, scope) for name, scope, role in names if role == "planned-add"}
    return [n for key, n in names.items() if not (key[2] == "planned-remove" and key[:2] in changed)]


def normalized(name):
    return re.sub(r"[_\-]", "", name).lower()


def code_files(root):
    """Every Go, Rust, JS, or TS file of the root, minus what git ignores."""
    extensions = {ext for _, exts, *_ in DECLARATIONS for ext in exts}
    listed = subprocess.run(
        ["git", "ls-files", "-co", "--exclude-standard"], cwd=root, capture_output=True, text=True
    )
    if listed.returncode == 0:
        paths = [Path(line) for line in listed.stdout.splitlines()]
    else:
        paths = [p.relative_to(root) for p in root.rglob("*") if not SKIPPED_DIRS & set(p.parts)]
    return [str(p) for p in paths if p.suffix in extensions and (root / p).is_file()]


def index_code(root):
    files = code_files(root)
    by_name, by_normal, scopes, tokens = {}, {}, set(), set()
    for decl in scan(files, root) if files else []:
        by_name.setdefault(decl.name, []).append(decl)
        by_normal.setdefault(normalized(decl.name), []).append(decl)
        if decl.kind in SCOPE_LABELS:
            scopes.add(decl.name)
    for path in files:
        tokens.update(IDENTIFIER_TOKEN.findall((root / path).read_text(errors="replace")))
    return CodeIndex(by_name, by_normal, scopes, tokens)


def classify(spec, code, planned_names):
    found = code.by_name.get(spec.name, [])
    scoped = [d for d in found if not spec.scope or d.scope == spec.scope]
    if spec.role == "planned-remove":
        return ("pending-remove", scoped or found) if found else ("removed", [])
    if scoped and spec.role == "planned-add" and spec.signature:
        same = [d for d in scoped if d.signature == spec.signature]
        return ("landed", same) if same else ("pending-change", scoped)
    if scoped:
        return "match", scoped
    if found:
        return ("scope-differs", found) if spec.scope in code.scopes else ("match", found)
    variants = code.by_normal.get(normalized(spec.name), []) if MULTI_WORD.search(spec.name) else []
    if variants:
        return "variant", variants
    if spec.role == "planned-add" or spec.name in planned_names:
        return "planned", []
    if spec.name in code.tokens:
        return "external", []
    if re.fullmatch(r"[a-z]+", spec.name) and not spec.scope:
        return "word", []
    close = difflib.get_close_matches(spec.name, list(code.by_name), n=1, cutoff=0.8)
    return "missing", code.by_name[close[0]][:1] if close else []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("notes_dir", nargs="?", default=".notes")
    parser.add_argument("--root", help="code root (default: git top-level of the cwd)")
    parser.add_argument("--todo", help="read only the TODO-N pair, not the whole corpus")
    parser.add_argument("--include", action="append", default=[], metavar="GLOB",
                        help="also read these notes-dir globs, e.g. 'research/*.md'")
    parser.add_argument("--all", action="store_true", help="also print the `external` and `word` rows")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    notes_dir = Path(args.notes_dir).resolve()
    if not notes_dir.is_dir():
        print(f"wm-spec-code-names: no notes dir at {notes_dir}", file=sys.stderr)
        return 2
    top = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    root = Path(args.root or (top.stdout.strip() if top.returncode == 0 else ".")).resolve()

    spec_names = read_spec(spec_files(notes_dir, args.todo, args.include), root)
    code = index_code(root)

    planned_names = {spec.name for spec in spec_names if spec.role == "planned-add"}
    rows = []
    for spec in spec_names:
        state, decls = classify(spec, code, planned_names)
        if state in HIDDEN_STATES and not args.all:
            continue
        first = decls[0] if decls else None
        rows.append({
            "state": state,
            "spec_name": f"{spec.scope}.{spec.name}" if spec.scope else spec.name,
            "role": spec.role,
            "spec_at": spec.sources[0],
            "spec_count": len(spec.sources),
            "code_name": (f"{first.scope}.{first.name}" if first.scope else first.name) if first else "",
            "kind": first.kind if first else "",
            "code_at": f"{first.path}:{first.line}" if first else "",
            "code_count": len(decls),
        })
    rows.sort(key=lambda r: (STATES.index(r["state"]), r["spec_name"].lower()))

    if args.json:
        print(json.dumps(rows, indent=2))
    else:
        print("| State | Spec name | Role | Spec at | Code name | Kind | Code at |")
        print("|---|---|---|---|---|---|---|")
        for r in rows:
            spec_at = r["spec_at"] + (f" (+{r['spec_count'] - 1})" if r["spec_count"] > 1 else "")
            code_at = r["code_at"] + (f" (+{r['code_count'] - 1})" if r["code_count"] > 1 else "")
            print(f"| {r['state']} | `{r['spec_name']}` | {r['role']} | {spec_at} | "
                  f"{'`' + r['code_name'] + '`' if r['code_name'] else ''} | {r['kind']} | {code_at} |")
    return 1 if any(r["state"] in FAILING_STATES for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
