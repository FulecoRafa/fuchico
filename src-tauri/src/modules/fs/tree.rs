use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

use super::to_canon;

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Dir,
    Symlink,
}

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub kind: EntryKind,
    pub size: u64,
    /// Milliseconds since UNIX epoch; 0 if unavailable.
    pub mtime: u64,
}

/// Lists immediate children of `path`. Dirs first, then files, each sorted
/// case-insensitively. Dot-prefixed entries (files and dirs) are hidden unless
/// `show_hidden` is set.
#[tauri::command]
pub fn fs_read_dir(path: String, show_hidden: bool) -> Result<Vec<DirEntry>, String> {
    let root = PathBuf::from(&path);
    let read = std::fs::read_dir(&root).map_err(|e| {
        log::debug!("fs_read_dir({}) failed: {e}", root.display());
        e.to_string()
    })?;

    let mut entries: Vec<DirEntry> = read
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;

            // `metadata()` follows symlinks → it returns the target's stat in
            // one syscall (file_type + size + mtime all derived from it). We
            // fall back to `symlink_metadata` for broken symlinks so we don't
            // silently drop them from the listing.
            let (meta, was_symlink) = match std::fs::metadata(entry.path()) {
                Ok(m) => (Some(m), false),
                Err(_) => (entry.metadata().ok(), true),
            };
            let meta = meta?;

            let kind = if was_symlink {
                EntryKind::Symlink
            } else if meta.is_dir() {
                EntryKind::Dir
            } else {
                EntryKind::File
            };

            if name.starts_with('.') && !show_hidden {
                return None;
            }

            let size = meta.len();
            let mtime = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            Some(DirEntry {
                name,
                kind,
                size,
                mtime,
            })
        })
        .collect();

    entries.sort_by(|a, b| {
        let rank = |k: &EntryKind| match k {
            EntryKind::Dir => 0,
            EntryKind::Symlink => 1,
            EntryKind::File => 2,
        };
        rank(&a.kind)
            .cmp(&rank(&b.kind))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", ".git"];

fn walk_markdown_files(dir: &Path, out: &mut Vec<PathBuf>) {
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
            walk_markdown_files(&path, out);
        } else if ft.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown") {
                    out.push(path);
                }
            }
        }
    }
}

/// Recursively lists every Markdown file under `root`, as absolute paths --
/// used by the editor's wikilink resolver/autocomplete, which needs the
/// full vault file set rather than the file explorer's lazily-expanded,
/// non-recursive `fs_read_dir` view.
#[tauri::command]
pub fn fs_list_markdown_files(root: String) -> Result<Vec<String>, String> {
    let root_path = PathBuf::from(&root);
    let mut files = Vec::new();
    walk_markdown_files(&root_path, &mut files);
    files.sort();
    Ok(files.iter().map(to_canon).collect())
}

#[cfg(test)]
mod markdown_files_tests {
    use super::*;

    #[test]
    fn lists_markdown_files_recursively_and_skips_dot_and_skip_dirs() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.md"), "a").unwrap();
        std::fs::create_dir(dir.path().join("sub")).unwrap();
        std::fs::write(dir.path().join("sub/b.markdown"), "b").unwrap();
        std::fs::write(dir.path().join("c.txt"), "c").unwrap();
        std::fs::create_dir(dir.path().join(".hidden")).unwrap();
        std::fs::write(dir.path().join(".hidden/d.md"), "d").unwrap();
        std::fs::create_dir(dir.path().join("node_modules")).unwrap();
        std::fs::write(dir.path().join("node_modules/e.md"), "e").unwrap();

        let files = fs_list_markdown_files(dir.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(files.len(), 2);
        assert!(files.iter().any(|f| f.ends_with("a.md")));
        assert!(files.iter().any(|f| f.ends_with("sub/b.markdown")));
    }
}
