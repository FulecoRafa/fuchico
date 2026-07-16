use std::path::{Path, PathBuf};

use serde::Serialize;

use super::fs::to_canon;

#[derive(Serialize)]
pub struct SearchMatch {
    pub file: String,
    /// 1-based line number.
    pub line: usize,
    /// 1-based column of the match start (byte offset into the line's chars).
    pub column: usize,
    /// The full text of the matching line, for context.
    pub text: String,
}

const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", ".git"];
/// Cap results so a broad query against a large vault doesn't blow up the
/// IPC payload or the results list.
const MAX_MATCHES: usize = 500;

fn walk_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(read) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in read.filter_map(Result::ok) {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with('.') {
            continue;
        }
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() {
            if SKIP_DIRS.contains(&name_str.as_ref()) {
                continue;
            }
            walk_files(&path, out);
        } else if ft.is_file() {
            out.push(path);
        }
    }
}

/// Case-insensitive substring search across every text file under `root`.
/// Binary files are skipped (detected by failing UTF-8 decode). Results are
/// capped at `MAX_MATCHES`, first-found order.
#[tauri::command]
pub fn search_files(root: String, query: String) -> Result<Vec<SearchMatch>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let root_path = PathBuf::from(&root);
    let mut files = Vec::new();
    walk_files(&root_path, &mut files);
    files.sort();

    let needle = query.to_lowercase();
    let mut matches = Vec::new();

    'files: for file in files {
        let Ok(content) = std::fs::read_to_string(&file) else {
            continue;
        };
        let file_str = to_canon(&file);

        for (idx, line) in content.lines().enumerate() {
            if let Some(byte_col) = line.to_lowercase().find(&needle) {
                let column = line[..byte_col].chars().count() + 1;
                matches.push(SearchMatch {
                    file: file_str.clone(),
                    line: idx + 1,
                    column,
                    text: line.to_string(),
                });
                if matches.len() >= MAX_MATCHES {
                    break 'files;
                }
            }
        }
    }

    Ok(matches)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_matches_case_insensitively_across_files() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.md"), "Hello World\nsecond line\n").unwrap();
        std::fs::write(dir.path().join("b.txt"), "no match here\nhello again\n").unwrap();
        let matches =
            search_files(dir.path().to_string_lossy().into_owned(), "hello".to_string()).unwrap();
        assert_eq!(matches.len(), 2);
        assert!(matches.iter().any(|m| m.text == "Hello World" && m.line == 1));
        assert!(matches.iter().any(|m| m.text == "hello again" && m.line == 2));
    }

    #[test]
    fn skips_dotfiles_and_skip_dirs() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("node_modules")).unwrap();
        std::fs::write(dir.path().join("node_modules/x.js"), "needle").unwrap();
        std::fs::write(dir.path().join(".hidden"), "needle").unwrap();
        std::fs::write(dir.path().join("ok.txt"), "needle").unwrap();
        let matches = search_files(
            dir.path().to_string_lossy().into_owned(),
            "needle".to_string(),
        )
        .unwrap();
        assert_eq!(matches.len(), 1);
        assert!(matches[0].file.ends_with("ok.txt"));
    }

    #[test]
    fn empty_query_returns_no_matches() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.txt"), "content").unwrap();
        let matches =
            search_files(dir.path().to_string_lossy().into_owned(), "  ".to_string()).unwrap();
        assert!(matches.is_empty());
    }
}
