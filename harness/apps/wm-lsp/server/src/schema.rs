use std::path::{Path, PathBuf};

use serde::Deserialize;

const SCHEMA_TOML: &str = include_str!("../../../../plugins/wm/schema/frontmatter.toml");

#[derive(Deserialize)]
pub struct Schema {
    pub files: Vec<FileType>,
    pub fields: Vec<Field>,
}

#[derive(Deserialize)]
pub struct FileType {
    #[serde(rename = "type")]
    pub name: String,
    pub names: Vec<String>,
    pub fields: FieldLayout,
    pub sections: Vec<String>,
}

#[derive(Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FieldLayout {
    Frontmatter,
    Entry,
    None,
}

#[derive(Deserialize)]
pub struct Field {
    pub file: String,
    pub key: String,
    pub kind: FieldKind,
    pub values: Vec<String>,
    pub required: bool,
    pub doc: String,
}

#[derive(Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum FieldKind {
    Enum,
    Text,
    TodoRefs,
    Progress,
}

/// A corpus file matched to its row: `star` is the TODO number the `*` matched, and
/// `index` is the pattern that matched; 0 is the new name.
pub struct Matched<'a> {
    pub file_type: &'a FileType,
    pub star: String,
    pub index: usize,
}

impl Schema {
    pub fn load() -> Schema {
        toml::from_str(SCHEMA_TOML).expect("schema/frontmatter.toml is embedded at build time and must parse")
    }

    /// `rel` is the path inside the notes dir, with `/` separators.
    pub fn match_file(&self, rel: &str) -> Option<Matched<'_>> {
        for file_type in &self.files {
            for (index, pattern) in file_type.names.iter().enumerate() {
                if let Some(star) = match_pattern(pattern, rel) {
                    return Some(Matched { file_type, star, index });
                }
            }
        }
        None
    }

    pub fn fields_of<'a>(&'a self, file_type: &'a FileType) -> impl Iterator<Item = &'a Field> {
        self.fields.iter().filter(move |field| field.file == file_type.name)
    }

    pub fn field<'a>(&'a self, file_type: &'a FileType, key: &str) -> Option<&'a Field> {
        self.fields_of(file_type).find(|field| field.key == key)
    }
}

impl Schema {
    fn todo_row(&self) -> Option<&FileType> {
        self.files.iter().find(|file_type| file_type.name == "todo")
    }

    /// The TODO id for the number a `*` matched, for example `TODO-3`.
    pub fn todo_id(&self, number: &str) -> Option<String> {
        Some(id_pattern(&self.todo_row()?.names[0]).replace('*', number))
    }

    /// The human half of the TODO with this id, under the first of its names that exists.
    pub fn todo_path(&self, root: &Path, id: &str) -> Option<PathBuf> {
        let row = self.todo_row()?;
        let number = match_pattern(id_pattern(&row.names[0]), id)?;
        (0..row.names.len()).map(|index| root.join(row.path_for(index, &number))).find(|path| path.exists())
    }

    /// The folders inside a notes dir that hold corpus files, as `""` and `"<dir>/"` prefixes.
    pub fn folders(&self) -> Vec<String> {
        let mut folders: Vec<String> = self
            .files
            .iter()
            .flat_map(|file_type| &file_type.names)
            .map(|name| name.rsplit_once('/').map_or(String::new(), |(dir, _)| format!("{dir}/")))
            .collect();
        folders.sort();
        folders.dedup();
        folders
    }

    /// The notes dir that holds `path`, and the path inside it with `/` separators.
    pub fn locate(&self, path: &Path) -> Option<(PathBuf, String)> {
        let dir = path.parent()?;
        let name = path.file_name()?.to_str()?;
        let dir_name = dir.file_name()?.to_str()?;
        if self.folders().contains(&format!("{dir_name}/")) {
            return Some((dir.parent()?.to_path_buf(), format!("{dir_name}/{name}")));
        }
        Some((dir.to_path_buf(), name.to_string()))
    }
}

/// The file name of a pattern up to its first `.`: `todos/TODO-*.todo` gives `TODO-*`.
fn id_pattern(pattern: &str) -> &str {
    let file = pattern.rsplit('/').next().unwrap_or(pattern);
    file.split('.').next().unwrap_or(file)
}

impl FieldLayout {
    /// The text before the key on a field line.
    pub fn line_prefix(self) -> &'static str {
        match self {
            FieldLayout::Entry => "- **",
            FieldLayout::Frontmatter | FieldLayout::None => "",
        }
    }

    /// The text between the key and the value on a field line.
    pub fn separator(self) -> &'static str {
        match self {
            FieldLayout::Entry => ":**",
            FieldLayout::Frontmatter | FieldLayout::None => ":",
        }
    }
}

impl FileType {
    pub fn path_for(&self, pattern_index: usize, star: &str) -> String {
        self.names[pattern_index].replace('*', star)
    }
}

/// Matches a pattern with at most one `*`, which stands for one or more digits.
fn match_pattern(pattern: &str, rel: &str) -> Option<String> {
    let Some((prefix, suffix)) = pattern.split_once('*') else {
        return (pattern == rel).then(String::new);
    };
    let middle = rel.strip_prefix(prefix)?.strip_suffix(suffix)?;
    let digits = !middle.is_empty() && middle.chars().all(|c| c.is_ascii_digit());
    digits.then(|| middle.to_string())
}
