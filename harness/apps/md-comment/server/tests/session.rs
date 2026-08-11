//! Protocol tests over `Session` — no transport, no event loop.

use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use md_comment::store::{Author, Comment, Store};
use md_comment::wire::{
    Change, Position, Range, COMMAND_ADD, COMMAND_COPY, COMMAND_DELETE, COMMAND_LIST,
    COMMAND_RESET, SEVERITY_HINT,
};
use md_comment::{anchor, Effect, Session};
use serde_json::json;

static COUNTER: AtomicUsize = AtomicUsize::new(0);

fn root() -> PathBuf {
    let unique = COUNTER.fetch_add(1, Ordering::SeqCst);
    let path =
        std::env::temp_dir().join(format!("md-comment-test-{}-{unique}", std::process::id()));
    std::fs::create_dir_all(&path).unwrap();
    path
}

fn open(text: &str) -> (Session, PathBuf, String) {
    let root = root();
    let uri = md_comment::path_to_uri(&root.join("docs").join("spec.md"));
    let (mut session, effects) = Session::new(root.clone());
    // Startup asks the client to watch the input file, then states the diagnostics.
    assert_eq!(
        effects,
        vec![Effect::WatchFiles, Effect::PublishDiagnostics]
    );
    session.did_open(&uri, text.to_string());
    (session, root, uri)
}

fn comment(session: &Session, index: usize) -> Comment {
    session.store().comments("docs/spec.md")[index].clone()
}

fn whole_file() -> Range {
    Range {
        start: Position {
            line: 0,
            character: 0,
        },
        end: Position {
            line: 10_000,
            character: 0,
        },
    }
}

fn at(line: u32) -> Position {
    Position { line, character: 0 }
}

/// Write a comment the way the operator does: run the add command, fill the input file
/// it asks for, and save. `line` is 0-based, as on the LSP wire.
fn add(session: &mut Session, uri: &str, line: u32, text: &str) {
    let effects = session.execute_command(COMMAND_ADD, &[json!(uri), json!(line + 1)]);
    let contents = effects
        .iter()
        .find_map(|effect| match effect {
            Effect::OpenInput { contents } => Some(contents.clone()),
            _ => None,
        })
        .expect("the add command hands over an input file");
    let path = session.input_path();
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, format!("{contents}{text}\n")).unwrap();
    session.drain_input();
}

#[test]
fn add_writes_a_comment_from_the_input_file() {
    let (mut session, _root, uri) = open("# Title\n\n## Design\n");

    let effects = session.execute_command(COMMAND_ADD, &[json!(uri), json!(3)]);
    let contents = match &effects[0] {
        Effect::OpenInput { contents } => contents.clone(),
        other => panic!("expected an input file, got {other:?}"),
    };
    assert_eq!(contents, "<!-- md-comment: docs/spec.md:3 -->\n\n");
    assert!(session.store().comments("docs/spec.md").is_empty());

    std::fs::create_dir_all(session.input_path().parent().unwrap()).unwrap();
    std::fs::write(session.input_path(), format!("{contents}needs a source\n")).unwrap();
    let effects = session.drain_input();

    assert_eq!(
        effects,
        vec![
            Effect::PersistStore,
            Effect::RefreshInlayHints,
            Effect::PublishDiagnostics
        ]
    );
    let stored = comment(&session, 0);
    assert_eq!(stored.line, 3);
    assert_eq!(stored.text, "needs a source");
    assert_eq!(stored.hash, anchor::line_hash("## Design"));
    assert!(!stored.orphaned);
}

#[test]
fn the_input_file_is_emptied_after_a_comment_is_taken() {
    let (mut session, _root, uri) = open("## Design\n");
    add(&mut session, &uri, 0, "needs a source");

    assert_eq!(std::fs::read_to_string(session.input_path()).unwrap(), "");
    // Draining again finds nothing, so a second save cannot duplicate the comment.
    assert!(session.drain_input().is_empty());
    assert_eq!(session.store().comments("docs/spec.md").len(), 1);
}

#[test]
fn adding_on_a_commented_line_replaces_the_text() {
    let (mut session, _root, uri) = open("## Design\n");
    add(&mut session, &uri, 0, "first");
    add(&mut session, &uri, 0, "second");

    assert_eq!(session.store().comments("docs/spec.md").len(), 1);
    assert_eq!(comment(&session, 0).text, "second");
}

#[test]
fn saving_an_empty_body_cancels_the_comment() {
    let (mut session, _root, uri) = open("## Design\n");
    let effects = session.execute_command(COMMAND_ADD, &[json!(uri), json!(1)]);
    let contents = match &effects[0] {
        Effect::OpenInput { contents } => contents.clone(),
        other => panic!("expected an input file, got {other:?}"),
    };
    std::fs::create_dir_all(session.input_path().parent().unwrap()).unwrap();
    std::fs::write(session.input_path(), contents).unwrap();

    assert!(session.drain_input().is_empty());
    assert!(session.store().comments("docs/spec.md").is_empty());
}

#[test]
fn a_multi_line_body_is_kept_whole() {
    let (mut session, _root, uri) = open("## Design\n");
    add(&mut session, &uri, 0, "first line\n\nsecond line");

    assert_eq!(comment(&session, 0).text, "first line\n\nsecond line");
    assert!(session.export_text().contains("first line\n\nsecond line"));
}

#[test]
fn inlay_hint_sits_at_the_end_of_the_line() {
    let (mut session, _root, uri) = open("# Title\n## Design\n");
    add(&mut session, &uri, 1, "needs a source");

    let hints = session.inlay_hints(&uri, whole_file());
    assert_eq!(hints.len(), 1);
    assert_eq!(
        hints[0].position,
        Position {
            line: 1,
            character: 9
        }
    );
    assert_eq!(hints[0].label, "💬 needs a source");
    assert!(hints[0].padding_left);
    assert_eq!(hints[0].tooltip.value, "needs a source");
    assert_eq!(hints[0].tooltip.kind, "markdown");
}

#[test]
fn inlay_hint_truncates_long_text_and_keeps_it_in_the_tooltip() {
    let long = "a claim that runs on well past the width of any inlay hint";
    let (mut session, _root, uri) = open("## Design\n");
    add(&mut session, &uri, 0, long);

    let hints = session.inlay_hints(&uri, whole_file());
    assert_eq!(
        hints[0].label,
        "💬 a claim that runs on well past the width…"
    );
    assert_eq!(hints[0].tooltip.value, long);
}

#[test]
fn a_comment_below_an_edit_shifts_down() {
    let (mut session, _root, uri) = open("a\nb\nc\n");
    add(&mut session, &uri, 2, "about c");
    let before = comment(&session, 0).hash.clone();

    session.did_change(
        &uri,
        &[Change {
            range: Some((0, 0, 0, 0)),
            text: "x\ny\n".to_string(),
        }],
    );

    let stored = comment(&session, 0);
    assert_eq!(stored.line, 5);
    assert_eq!(stored.hash, before);
    assert!(!stored.orphaned);
}

#[test]
fn editing_the_commented_line_keeps_the_comment_and_refreshes_the_hash() {
    let (mut session, _root, uri) = open("## Design\n");
    add(&mut session, &uri, 0, "needs a source");

    session.did_change(
        &uri,
        &[Change {
            range: Some((0, 0, 0, 9)),
            text: "## Plan".to_string(),
        }],
    );

    let stored = comment(&session, 0);
    assert_eq!(stored.line, 1);
    assert_eq!(stored.hash, anchor::line_hash("## Plan"));
    assert!(!stored.orphaned);
}

#[test]
fn deleting_the_commented_line_keeps_the_comment() {
    let (mut session, _root, uri) = open("a\nb\nc\n");
    add(&mut session, &uri, 1, "about b");

    session.did_change(
        &uri,
        &[Change {
            range: Some((1, 0, 2, 0)),
            text: String::new(),
        }],
    );

    let stored = comment(&session, 0);
    assert_eq!(stored.line, 2);
    assert_eq!(stored.hash, anchor::line_hash("c"));
    assert_eq!(stored.text, "about b");
}

#[test]
fn reopening_reanchors_a_moved_line_by_hash() {
    let (mut session, _root, uri) = open("# Title\n\n## Design\n");
    add(&mut session, &uri, 2, "needs a source");

    session.did_open(&uri, "# Title\n\nnew\nlines\n\n## Design\n".to_string());

    let stored = comment(&session, 0);
    assert_eq!(stored.line, 6);
    assert!(!stored.orphaned);
}

#[test]
fn reanchoring_picks_the_match_nearest_the_stored_line() {
    let text = "a\n---\nb\nc\nd\ne\nf\ng\nh\n---\n";
    let (mut session, _root, uri) = open(text);
    add(&mut session, &uri, 1, "about the first rule");
    assert_eq!(comment(&session, 0).line, 2);

    // Two blank lines pushed in at the top: the rules are now on lines 4 and 12.
    session.did_open(&uri, format!("x\ny\n{text}"));

    assert_eq!(comment(&session, 0).line, 4);
}

#[test]
fn a_lost_anchor_becomes_orphaned_and_is_still_shown() {
    let (mut session, _root, uri) = open("# Title\n## Design\n");
    add(&mut session, &uri, 1, "needs a source");

    session.did_open(&uri, "# Title\n## Something else\n".to_string());

    let stored = comment(&session, 0);
    assert!(stored.orphaned);
    assert_eq!(stored.line, 2);
    let hints = session.inlay_hints(&uri, whole_file());
    assert_eq!(hints[0].label, "💬? needs a source");
}

#[test]
fn a_recovered_anchor_clears_the_orphan_flag() {
    let (mut session, _root, uri) = open("# Title\n## Design\n");
    add(&mut session, &uri, 1, "needs a source");
    session.did_open(&uri, "# Title\n## Something else\n".to_string());
    assert!(comment(&session, 0).orphaned);

    session.did_open(&uri, "# Title\n\n## Design\n".to_string());

    let stored = comment(&session, 0);
    assert!(!stored.orphaned);
    assert_eq!(stored.line, 3);
}

#[test]
fn a_commented_line_offers_edit_and_delete_instead_of_add() {
    let (mut session, _root, uri) = open("a\nb\n");
    add(&mut session, &uri, 0, "about a");

    let commented = session.code_actions(
        &uri,
        Range {
            start: at(0),
            end: at(0),
        },
    );
    let titles: Vec<&str> = commented.iter().map(|a| a.title.as_str()).collect();
    assert_eq!(
        titles,
        vec![
            "edit comment: about a",
            "delete comment: about a",
            "list comments",
            "copy comments",
            "reset comments"
        ]
    );
    assert_eq!(commented[0].command.command, COMMAND_ADD);
    assert_eq!(commented[0].command.arguments, vec![json!(uri), json!(1)]);
    assert_eq!(commented[1].command.command, COMMAND_DELETE);
    assert_eq!(commented[1].command.arguments, vec![json!(uri), json!(1)]);
    assert_eq!(commented[0].kind, "refactor");
}

#[test]
fn a_clean_line_offers_add() {
    let (mut session, _root, uri) = open("a\nb\n");
    add(&mut session, &uri, 0, "about a");

    let clean = session.code_actions(
        &uri,
        Range {
            start: at(1),
            end: at(1),
        },
    );
    let titles: Vec<&str> = clean.iter().map(|a| a.title.as_str()).collect();
    assert_eq!(
        titles,
        vec![
            "add comment",
            "list comments",
            "copy comments",
            "reset comments"
        ]
    );
    assert_eq!(clean[0].command.command, COMMAND_ADD);
    assert_eq!(clean[0].command.arguments, vec![json!(uri), json!(2)]);
}

#[test]
fn a_leftover_input_file_is_taken_at_startup() {
    let root = root();
    let target = root.join("docs").join("spec.md");
    std::fs::create_dir_all(target.parent().unwrap()).unwrap();
    std::fs::write(&target, "# Title\n## Design\n").unwrap();
    std::fs::create_dir_all(root.join(".tmp")).unwrap();
    std::fs::write(
        root.join(".tmp").join("md-comment-input.md"),
        "<!-- md-comment: docs/spec.md:2 -->\n\nsurvived the crash\n",
    )
    .unwrap();

    // A server that died before the watch fired never saw this save.
    let (session, effects) = Session::new(root.clone());

    assert_eq!(
        effects,
        vec![
            Effect::WatchFiles,
            Effect::PersistStore,
            Effect::RefreshInlayHints,
            Effect::PublishDiagnostics,
            Effect::PublishDiagnostics
        ]
    );
    let stored = &session.store().comments("docs/spec.md")[0];
    assert_eq!(stored.text, "survived the crash");
    assert_eq!(stored.line, 2);
    // Anchored against the file on disk, since no buffer was ever open.
    assert_eq!(stored.hash, md_comment::anchor::line_hash("## Design"));
}

#[test]
fn delete_removes_the_comment() {
    let (mut session, _root, uri) = open("a\n");
    add(&mut session, &uri, 0, "about a");

    let effects = session.execute_command(COMMAND_DELETE, &[json!(uri), json!(1)]);

    assert_eq!(
        effects,
        vec![
            Effect::PersistStore,
            Effect::RefreshInlayHints,
            Effect::PublishDiagnostics
        ]
    );
    assert!(session.store().comments("docs/spec.md").is_empty());
    assert!(session.inlay_hints(&uri, whole_file()).is_empty());
}

#[test]
fn the_export_matches_lumen_format_byte_for_byte() {
    let root = root();
    let (mut session, _effects) = Session::new(root.clone());
    let spec = md_comment::path_to_uri(&root.join("docs").join("spec.md"));
    let plan = md_comment::path_to_uri(&root.join("docs").join("plan.md"));

    session.did_open(&spec, "# Title\n## Design\n".to_string());
    add(&mut session, &spec, 1, "needs a source");
    session.did_open(&plan, "a\nb\nc\n".to_string());
    add(&mut session, &plan, 2, "this contradicts the spec");
    session.did_open(&plan, "a\nb\nrewritten\n".to_string());

    assert_eq!(
        session.export_text(),
        "# line comments\n\
         \n\
         **docs/plan.md** line 3 (RIGHT) (orphaned)\n\
         \n\
         this contradicts the spec\n\
         \n\
         ---\n\
         \n\
         **docs/spec.md** line 2 (RIGHT)\n\
         \n\
         needs a source\n"
    );
}

#[test]
fn the_export_names_the_author_so_claude_skips_its_own_comments() {
    let (mut session, _root, uri) = open("## Design\n## Plan\n");
    add(&mut session, &uri, 0, "needs a source");
    session.upsert_comment("docs/spec.md", 2, "unreachable".to_string(), Author::Agent);

    let export = session.export_text();
    assert!(
        export.contains("**docs/spec.md** line 1 (RIGHT)\n"),
        "{export}"
    );
    assert!(
        export.contains("**docs/spec.md** line 2 (RIGHT) (from Claude)\n"),
        "{export}"
    );
}

#[test]
fn an_empty_store_exports_the_header_only() {
    let (session, _root, _uri) = open("a\n");
    assert_eq!(session.export_text(), "# line comments\n");
}

#[test]
fn copy_writes_the_export_and_names_the_path() {
    let (mut session, root, uri) = open("a\n");
    add(&mut session, &uri, 0, "about a");

    let effects = session.execute_command(COMMAND_COPY, &[]);
    assert_eq!(
        effects,
        vec![
            Effect::WriteExport,
            Effect::ShowMessage {
                error: false,
                text: "1 comment → .tmp/md-comment.md".to_string()
            }
        ]
    );

    session.write_export().unwrap();
    let written = std::fs::read_to_string(root.join(".tmp").join("md-comment.md")).unwrap();
    assert_eq!(written, session.export_text());
}

/// Write the file on disk too, so the export path can read it back.
fn on_disk(root: &std::path::Path, text: &str) -> String {
    let path = root.join("docs").join("spec.md");
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, text).unwrap();
    md_comment::path_to_uri(&path)
}

#[test]
fn copy_reanchors_a_file_that_moved_while_it_was_closed() {
    let root = root();
    let uri = on_disk(&root, "# Title\n\n## Design\n");
    let (mut session, _effects) = Session::new(root.clone());
    session.did_open(&uri, "# Title\n\n## Design\n".to_string());
    add(&mut session, &uri, 2, "needs a source");
    session.did_close(&uri);

    // Edited by something else — git, another editor, an agent.
    on_disk(&root, "# Title\n\nnew\nlines\n\n## Design\n");

    let effects = session.execute_command(COMMAND_COPY, &[]);

    assert_eq!(comment(&session, 0).line, 6);
    assert!(effects.contains(&Effect::PersistStore));
    assert!(effects.contains(&Effect::RefreshInlayHints));
    assert!(session
        .export_text()
        .contains("**docs/spec.md** line 6 (RIGHT)"));
}

#[test]
fn copy_marks_a_vanished_anchor_orphaned() {
    let root = root();
    let uri = on_disk(&root, "# Title\n## Design\n");
    let (mut session, _effects) = Session::new(root.clone());
    session.did_open(&uri, "# Title\n## Design\n".to_string());
    add(&mut session, &uri, 1, "needs a source");
    session.did_close(&uri);

    on_disk(&root, "# Title\n## Something else\n");
    session.execute_command(COMMAND_COPY, &[]);

    assert!(comment(&session, 0).orphaned);
    assert!(session
        .export_text()
        .contains("**docs/spec.md** line 2 (RIGHT) (orphaned)"));
}

#[test]
fn copy_leaves_anchors_alone_when_the_file_cannot_be_read() {
    let (mut session, _root, uri) = open("# Title\n## Design\n");
    add(&mut session, &uri, 1, "needs a source");
    session.did_close(&uri);

    // The file was never written to disk, so reading it fails.
    session.execute_command(COMMAND_COPY, &[]);

    let stored = comment(&session, 0);
    assert_eq!(stored.line, 2);
    assert!(!stored.orphaned);
}

#[test]
fn reset_asks_first_and_only_clears_on_confirmation() {
    let (mut session, _root, uri) = open("a\nb\n");
    add(&mut session, &uri, 0, "about a");
    add(&mut session, &uri, 1, "about b");

    let effects = session.execute_command(COMMAND_RESET, &[]);
    assert_eq!(
        effects,
        vec![Effect::AskResetConfirmation {
            prompt: "Delete 2 comments in 1 file?".to_string()
        }]
    );
    // Cancel: nothing else is called, so the store stands.
    assert_eq!(session.store().total(), 2);

    let effects = session.reset_confirmed();
    assert_eq!(
        effects,
        vec![
            Effect::PersistStore,
            Effect::RefreshInlayHints,
            Effect::PublishDiagnostics
        ]
    );
    assert_eq!(session.store().total(), 0);
}

#[test]
fn reset_with_no_comments_says_so() {
    let (mut session, _root, _uri) = open("a\n");
    let effects = session.execute_command(COMMAND_RESET, &[]);
    assert_eq!(
        effects,
        vec![Effect::ShowMessage {
            error: false,
            text: "no comments to reset".to_string()
        }]
    );
}

#[test]
fn a_store_written_by_an_earlier_run_loads_unchanged() {
    let (mut session, root, uri) = open("## Design\n");
    add(&mut session, &uri, 0, "needs a source");
    session.persist().unwrap();

    let (reloaded, effects) = Session::new(root.clone());
    assert_eq!(
        effects,
        vec![Effect::WatchFiles, Effect::PublishDiagnostics]
    );
    assert_eq!(
        reloaded.store().comments("docs/spec.md"),
        session.store().comments("docs/spec.md")
    );
    assert!(root.join(".tmp").join("md-comment.json").exists());
}

#[test]
fn an_unsupported_store_version_starts_empty_and_reports_it() {
    let root = root();
    std::fs::create_dir_all(root.join(".tmp")).unwrap();
    std::fs::write(
        root.join(".tmp").join("md-comment.json"),
        r#"{"version":99,"files":{}}"#,
    )
    .unwrap();

    let (session, effects) = Session::new(root);

    assert_eq!(session.store().total(), 0);
    assert!(matches!(
        effects.first(),
        Some(Effect::ShowMessage { error: true, .. })
    ));
}

#[test]
fn every_file_type_is_served() {
    let root = root();
    let (session, _effects) = Session::new(root.clone());

    for (path, key) in [
        ("notes.txt", "notes.txt"),
        ("docs/a.md", "docs/a.md"),
        ("src/main.rs", "src/main.rs"),
        ("Makefile", "Makefile"),
    ] {
        assert_eq!(
            session.key(&md_comment::path_to_uri(&root.join(path))),
            Some(key.to_string()),
            "{path} should be served"
        );
    }
}

#[test]
fn the_servers_own_scratch_files_are_not_served() {
    let root = root();
    let (session, _effects) = Session::new(root.clone());

    for name in ["md-comment.md", "md-comment.json", "md-comment-input.md"] {
        assert!(
            session
                .key(&md_comment::path_to_uri(&root.join(".tmp").join(name)))
                .is_none(),
            ".tmp/{name} should not be served"
        );
    }
}

#[test]
fn a_file_outside_the_root_keeps_its_absolute_path() {
    let root = root();
    let (session, _effects) = Session::new(root);
    let outside = PathBuf::from("/tmp/elsewhere/notes.md");

    assert_eq!(
        session.key(&md_comment::path_to_uri(&outside)),
        Some("/tmp/elsewhere/notes.md".to_string())
    );
}

#[test]
fn an_agent_comment_is_marked_in_the_diagnostic_and_the_human_one_is_not() {
    let (mut session, _root, uri) = open("## Design\n## Plan\n");
    add(&mut session, &uri, 0, "needs a source");
    session.upsert_comment("docs/spec.md", 2, "unreachable".to_string(), Author::Agent);

    let payload = session
        .diagnostics()
        .into_iter()
        .find(|payload| payload.uri == uri)
        .expect("the commented file is published");
    assert_eq!(payload.diagnostics[0].message, "needs a source");
    assert_eq!(payload.diagnostics[1].message, "🤖 unreachable");
    // One severity for both authors — Zed filters diagnostics by severity alone.
    assert!(payload
        .diagnostics
        .iter()
        .all(|d| d.severity == SEVERITY_HINT));
}

#[test]
fn a_store_written_from_outside_is_taken_up_on_the_watch() {
    let (mut session, root, uri) = open("## Design\n");
    add(&mut session, &uri, 0, "from the editor");

    // What the `comment` subcommand does: a second session on the same root, writing the
    // store while the first one holds it open.
    let (mut writer, _effects) = Session::new(root);
    writer.upsert_comment("docs/spec.md", 1, "from Claude".to_string(), Author::Agent);
    writer.persist().unwrap();

    let effects = session.reload_store();
    assert_eq!(
        effects,
        vec![Effect::RefreshInlayHints, Effect::PublishDiagnostics]
    );
    assert_eq!(comment(&session, 0).text, "from Claude");
    assert_eq!(comment(&session, 0).author, Author::Agent);
}

#[test]
fn reloading_an_unchanged_store_asks_for_no_work() {
    let (mut session, _root, uri) = open("## Design\n");
    add(&mut session, &uri, 0, "needs a source");
    session.persist().unwrap();

    // The server's own persist fires the same watch. Reading back what was just written
    // has to be silent, or every keystroke would republish.
    assert!(session.reload_store().is_empty());
}

#[test]
fn store_upsert_keeps_one_comment_per_line_sorted() {
    let mut store = Store::default();
    for line in [5usize, 2, 5] {
        store.upsert(
            "a.md",
            Comment {
                line,
                hash: "h".to_string(),
                text: format!("line {line}"),
                orphaned: false,
                author: Author::Human,
            },
        );
    }

    let lines: Vec<usize> = store.comments("a.md").iter().map(|c| c.line).collect();
    assert_eq!(lines, vec![2, 5]);
    assert!(store.remove("a.md", 2));
    assert!(!store.remove("a.md", 42));
    assert_eq!(store.total(), 1);
}

#[test]
fn positions_count_utf16_units() {
    let text = "héllo wörld\nsecond\n";
    assert_eq!(anchor::utf16_len("héllo wörld"), 11);
    assert_eq!(anchor::byte_offset(text, 1, 0), "héllo wörld\n".len());
}

#[test]
fn a_comment_is_published_as_a_hint_diagnostic() {
    let (mut session, root, uri) = open("# Title\n## Design\n");
    add(&mut session, &uri, 1, "needs a source");

    let payloads = session.diagnostics();
    assert_eq!(payloads.len(), 1);
    let payload = &payloads[0];
    assert_eq!(
        payload.uri,
        md_comment::path_to_uri(&root.join("docs").join("spec.md"))
    );
    assert_eq!(payload.diagnostics.len(), 1);
    let diagnostic = &payload.diagnostics[0];
    assert_eq!(diagnostic.severity, SEVERITY_HINT);
    assert_eq!(diagnostic.source, "md-comment");
    assert_eq!(diagnostic.message, "needs a source");
    // The whole anchored line, so the editor underlines the text the comment is about.
    assert_eq!(diagnostic.range.start, at(1));
    assert_eq!(diagnostic.range.end.line, 1);
    assert_eq!(diagnostic.range.end.character, 9);
}

#[test]
fn an_orphaned_comment_says_so_in_its_diagnostic() {
    let (mut session, _root, uri) = open("# Title\n## Design\n");
    add(&mut session, &uri, 1, "needs a source");
    session.did_open(&uri, "# Title\n## Something else\n".to_string());

    let payloads = session.diagnostics();
    assert_eq!(
        payloads[0].diagnostics[0].message,
        "needs a source (orphaned)"
    );
}

#[test]
fn deleting_the_last_comment_clears_the_file_diagnostics() {
    let (mut session, _root, uri) = open("a\n");
    add(&mut session, &uri, 0, "about a");
    let published = session.diagnostics();
    assert_eq!(published[0].diagnostics.len(), 1);

    session.execute_command(COMMAND_DELETE, &[json!(uri), json!(1)]);
    let cleared = session.diagnostics();

    // The editor keeps what it was last told, so an empty list has to be sent.
    assert_eq!(cleared.len(), 1);
    assert!(cleared[0].diagnostics.is_empty());
    // And once cleared, nothing is republished for that file.
    assert!(session.diagnostics().is_empty());
}

#[test]
fn list_writes_the_export_and_hands_over_a_view() {
    let (mut session, root, uri) = open("a\n");
    add(&mut session, &uri, 0, "about a");

    let effects = session.execute_command(COMMAND_LIST, &[]);

    let view = effects.iter().find_map(|effect| match effect {
        Effect::OpenList { contents } => Some(contents.clone()),
        _ => None,
    });
    assert_eq!(view.as_deref(), Some(session.export_text().as_str()));
    assert!(effects.contains(&Effect::WriteExport));
    assert!(view.unwrap().contains("**docs/spec.md** line 1 (RIGHT)"));
    assert_eq!(
        session.list_path(),
        root.join(".tmp").join("md-comment-list.md")
    );
}

#[test]
fn list_with_no_comments_says_so_and_opens_nothing() {
    let (mut session, _root, _uri) = open("a\n");

    let effects = session.execute_command(COMMAND_LIST, &[]);

    assert!(!effects
        .iter()
        .any(|effect| matches!(effect, Effect::OpenList { .. })));
    assert!(effects.contains(&Effect::ShowMessage {
        error: false,
        text: "no comments yet".to_string()
    }));
}
