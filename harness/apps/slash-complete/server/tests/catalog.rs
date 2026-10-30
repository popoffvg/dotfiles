use std::fs;
use std::path::Path;

use slash_complete::{catalog, completion_items, slash_token_start, Kind};

fn write(path: &Path, text: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn temp_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("slash-complete-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn catalog_reads_every_source_and_project_hides_home() {
    let home = temp_dir("home");
    let project = temp_dir("project");
    write(
        &home.join(".claude/skills/critic/SKILL.md"),
        "---\nname: critic\ndescription: >\n  Attack the\n  decision.\nargument-hint: [decision]\n---\n# body\n",
    );
    write(&home.join(".claude/commands/git/lumen.md"), "---\ndescription: \"Review the diff\"\n---\nbody\n");
    write(&home.join(".agents/skills/arch/SKILL.md"), "---\ndescription: Plan it\n---\n");
    write(&home.join(".agents/commands/plain.md"), "# Plain heading\n\ntext\n");
    write(&project.join(".claude/skills/critic/SKILL.md"), "---\nname: critic\ndescription: project one\n---\n");
    write(&project.join(".agents/commands/ship.md"), "---\ndescription: Ship it\n---\n");
    write(&project.join(".cursor/skills/lint/SKILL.md"), "---\nname: lint\n---\n");
    write(&home.join(".cursor/commands/fmt.md"), "---\ndescription: Format\n---\n");
    let plugin = home.join("plugins/wm");
    write(&plugin.join(".claude-plugin/plugin.json"), r#"{"name":"wm"}"#);
    write(&plugin.join("skills/dive/SKILL.md"), "---\nname: dive\ndescription: Research\n---\n");
    write(&plugin.join("commands/code.md"), "---\ndescription: Code\n---\n");
    let off = home.join("plugins/off");
    write(&off.join("skills/hidden/SKILL.md"), "---\nname: hidden\n---\n");
    write(
        &home.join(".claude/settings.json"),
        r#"{"enabledPlugins":{"wm@local":true,"off@local":false}}"#,
    );
    write(
        &home.join(".claude/plugins/installed_plugins.json"),
        &format!(
            r#"{{"plugins":{{"wm@local":[{{"installPath":"{}"}}],"off@local":[{{"installPath":"{}"}}]}}}}"#,
            plugin.display(),
            off.display()
        ),
    );

    let entries = catalog(&home, Some(&project));
    let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
    assert_eq!(names, ["arch", "critic", "fmt", "lint", "lumen", "plain", "ship", "wm:code", "wm:dive"]);
    let origin = |name: &str| entries.iter().find(|e| e.name == name).unwrap().origin.clone();
    assert_eq!(
        [origin("ship"), origin("lint"), origin("fmt")],
        ["project agents command", "project cursor skill", "cursor command"]
    );

    let critic = entries.iter().find(|e| e.name == "critic").unwrap();
    assert_eq!(critic.origin, "project skill");
    assert_eq!(critic.description, "project one");
    let lumen = entries.iter().find(|e| e.name == "lumen").unwrap();
    assert_eq!((lumen.kind, lumen.description.as_str()), (Kind::Command, "Review the diff"));
    let plain = entries.iter().find(|e| e.name == "plain").unwrap();
    assert_eq!(plain.description, "Plain heading");

    let home_only = catalog(&home, None);
    let critic = home_only.iter().find(|e| e.name == "critic").unwrap();
    assert_eq!((critic.description.as_str(), critic.argument_hint.as_str()), ("Attack the decision.", "[decision]"));
}

#[test]
fn slash_token_start_finds_only_an_opening_slash() {
    assert_eq!(slash_token_start("/", 1), Some(0));
    assert_eq!(slash_token_start("run /wm:co", 10), Some(4));
    assert_eq!(slash_token_start("ёж /cr", 6), Some(3));
    assert_eq!(slash_token_start("a/b", 3), None);
    assert_eq!(slash_token_start("/crit ic", 8), None);
    assert_eq!(slash_token_start("no slash", 3), None);
}

#[test]
fn completion_items_replace_the_token() {
    let home = temp_dir("items");
    write(&home.join(".claude/skills/critic/SKILL.md"), "---\nname: critic\n---\n");
    let result = completion_items(&catalog(&home, None), 2, 4, 7);
    let item = &result["items"][0];
    assert_eq!(item["textEdit"]["newText"], "/critic");
    assert_eq!(item["textEdit"]["range"]["start"]["character"], 4);
    assert_eq!(item["textEdit"]["range"]["end"]["character"], 7);
}
