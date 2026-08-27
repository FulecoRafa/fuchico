use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Emitter;

use super::fs::file::write_atomic;
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


#[derive(Serialize, Default, Debug, PartialEq)]
pub struct ReplaceResult {
    pub files_changed: usize,
    pub replacements: usize,
}

/// Case-insensitive replace of every `query` occurrence (with the same file
/// walk and matching rules as `search_files`). Replaces the substring as
/// written on disk with `replacement` verbatim. Only files whose canonical
/// path is in `files` are touched when the list is given. Returns the
/// number of files and occurrences changed.
fn replace_in_content(content: &str, needle_lower: &str, replacement: &str) -> Option<(String, usize)> {
    let lower = content.to_lowercase();
    // to_lowercase can change byte lengths for some scripts; fall back to a
    // char-wise comparison when the lengths diverge so we never slice
    // inside a char boundary.
    if lower.len() != content.len() {
        return replace_by_chars(content, needle_lower, replacement);
    }
    let mut out = String::with_capacity(content.len());
    let mut count = 0;
    let mut pos = 0;
    while let Some(rel) = lower[pos..].find(needle_lower) {
        let at = pos + rel;
        out.push_str(&content[pos..at]);
        out.push_str(replacement);
        pos = at + needle_lower.len();
        count += 1;
    }
    if count == 0 {
        return None;
    }
    out.push_str(&content[pos..]);
    Some((out, count))
}

fn replace_by_chars(content: &str, needle_lower: &str, replacement: &str) -> Option<(String, usize)> {
    let chars: Vec<char> = content.chars().collect();
    let needle: Vec<char> = needle_lower.chars().collect();
    let mut out = String::with_capacity(content.len());
    let mut count = 0;
    let mut i = 0;
    while i < chars.len() {
        let hit = i + needle.len() <= chars.len()
            && chars[i..i + needle.len()]
                .iter()
                .zip(&needle)
                .all(|(a, b)| a.to_lowercase().eq(b.to_lowercase()));
        if hit {
            out.push_str(replacement);
            i += needle.len();
            count += 1;
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    (count > 0).then_some((out, count))
}

fn do_replace(
    root: &str,
    query: &str,
    replacement: &str,
    files: Option<&[String]>,
    mut on_written: impl FnMut(&str),
) -> Result<ReplaceResult, String> {
    if query.trim().is_empty() {
        return Ok(ReplaceResult::default());
    }
    let mut paths = Vec::new();
    walk_files(Path::new(root), &mut paths);
    paths.sort();
    let needle = query.to_lowercase();
    let mut result = ReplaceResult::default();
    for file in paths {
        let file_str = to_canon(&file);
        if let Some(allow) = files {
            if !allow.iter().any(|f| *f == file_str) {
                continue;
            }
        }
        let Ok(content) = std::fs::read_to_string(&file) else {
            continue;
        };
        let Some((next, n)) = replace_in_content(&content, &needle, replacement) else {
            continue;
        };
        let perms = std::fs::metadata(&file).ok().map(|m| m.permissions());
        write_atomic(&file, next.as_bytes()).map_err(|e| format!("{}: {e}", file.display()))?;
        if let Some(perms) = perms {
            let _ = std::fs::set_permissions(&file, perms);
        }
        result.files_changed += 1;
        result.replacements += n;
        on_written(&file_str);
    }
    Ok(result)
}

#[tauri::command]
pub fn search_replace_files(
    root: String,
    query: String,
    replacement: String,
    files: Option<Vec<String>>,
    app: tauri::AppHandle,
) -> Result<ReplaceResult, String> {
    do_replace(&root, &query, &replacement, files.as_deref(), |path| {
        let _ = app.emit(
            "fs:file-written",
            serde_json::json!({ "path": path, "source": "replace" }),
        );
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_case_insensitively_and_reports_counts() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.md"), "Hello hello\nHELLO\n").unwrap();
        std::fs::write(dir.path().join("b.md"), "nothing\n").unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let mut written = Vec::new();
        let r = do_replace(&root, "hello", "bye", None, |p| written.push(p.to_string())).unwrap();
        assert_eq!(r, ReplaceResult { files_changed: 1, replacements: 3 });
        assert_eq!(std::fs::read_to_string(dir.path().join("a.md")).unwrap(), "bye bye\nbye\n");
        assert_eq!(written.len(), 1);
        assert!(written[0].ends_with("a.md"));
    }

    #[test]
    fn restricts_to_given_files() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.md"), "x").unwrap();
        std::fs::write(dir.path().join("b.md"), "x").unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let only = vec![to_canon(dir.path().join("b.md"))];
        let r = do_replace(&root, "x", "y", Some(&only), |_| {}).unwrap();
        assert_eq!(r.files_changed, 1);
        assert_eq!(std::fs::read_to_string(dir.path().join("a.md")).unwrap(), "x");
        assert_eq!(std::fs::read_to_string(dir.path().join("b.md")).unwrap(), "y");
    }

    #[test]
    fn handles_multibyte_case_folding() {
        assert_eq!(
            // "İ" lowercases to two code points, so the byte lengths diverge
            // and the char-wise path runs; it must not panic or mis-slice.
            replace_in_content("İstanbul istanbul", "istanbul", "X"),
            Some(("İstanbul X".to_string(), 1))
        );
    }

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
