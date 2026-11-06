mod check;
mod corpus;
mod lsp;
mod schema;

use std::path::Path;
use std::process::ExitCode;

use check::CHECKS;
use schema::Schema;

const USAGE: &str = "usage:
  wm-lsp                      start the language server on stdio
  wm-lsp lint <notes-dir> [--json]
                              print a verdict per check and every finding;
                              exit 0 clean, 1 on a finding, 2 on an unusable notes dir
  wm-lsp next <notes-dir>     print each TODO, its status, and whether it is ready";

fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let schema = Schema::load();
    match arguments.iter().map(String::as_str).collect::<Vec<_>>().as_slice() {
        [] => match lsp::run(&schema) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("wm-lsp: {error}");
                ExitCode::from(2)
            }
        },
        ["lint", dir] => lint(&schema, Path::new(dir), false),
        ["lint", dir, "--json"] => lint(&schema, Path::new(dir), true),
        ["next", dir] => next(&schema, Path::new(dir)),
        _ => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}

fn lint(schema: &Schema, root: &Path, json: bool) -> ExitCode {
    if !corpus::is_usable(schema, root) {
        eprintln!("wm-lsp: {} is not a notes dir: no INTENT.spec or spec.md", root.display());
        return ExitCode::from(2);
    }
    let findings = corpus::lint(schema, root);
    if json {
        let rows: Vec<serde_json::Value> = findings
            .iter()
            .map(|f| serde_json::json!({"file": f.file, "line": f.line + 1, "check": f.check, "message": f.message}))
            .collect();
        println!("{}", serde_json::to_string_pretty(&rows).unwrap_or_default());
    } else {
        println!("wm-lsp lint {}\n", root.display());
        for (id, title) in CHECKS {
            let count = findings.iter().filter(|f| f.check == *id).count();
            let verdict = if count == 0 { "clean".to_string() } else { format!("{count} finding(s)") };
            println!("  [{id}] {title:<66} {verdict}");
        }
        if !findings.is_empty() {
            println!("\nFindings\n");
        }
        for f in &findings {
            println!("  {}:{}:{}  [{}] {}", f.file, f.line + 1, f.start + 1, f.check, f.message);
        }
    }
    if findings.is_empty() { ExitCode::SUCCESS } else { ExitCode::from(1) }
}

fn next(schema: &Schema, root: &Path) -> ExitCode {
    if !corpus::is_usable(schema, root) {
        eprintln!("wm-lsp: {} is not a notes dir: no INTENT.spec or spec.md", root.display());
        return ExitCode::from(2);
    }
    println!("{:<8} {:<8} {:<20} ready", "TODO", "status", "depends_on");
    for todo in corpus::ledger(schema, root) {
        let ready = if todo.ready { "yes" } else { "" };
        println!("{:<8} {:<8} {:<20} {ready}", todo.id, todo.status, todo.depends_on.join(", "));
    }
    ExitCode::SUCCESS
}
