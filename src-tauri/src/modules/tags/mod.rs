use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use regex::Regex;
use serde::Serialize;

use super::fs::to_canon;

#[derive(Serialize)]
pub struct TagEntry {
    pub tag: String,
    pub count: usize,
    /// Absolute paths of every note referencing this tag (deduped).
    pub files: Vec<String>,
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

/// Mirrors `matchInlineTagsInLine` in
/// `src/modules/tags/lib/parseTags.ts` -- keep the two in sync:
///   - `#` must be preceded by start-of-line or whitespace (excludes
///     mid-word hits and URL fragments like `example.com/#frag`);
///   - `#` must be followed by a letter (excludes bare `#123`, and --
///     since ATX headings require a space after their `#`s -- naturally
///     excludes `# Heading` too);
///   - the tag body may contain letters, digits, `_`, `-`, `/` (nesting),
///     with trailing separators trimmed.
struct TagPatterns {
    tag: Regex,
    code_span: Regex,
    fence: Regex,
}

impl TagPatterns {
    fn new() -> Self {
        Self {
            tag: Regex::new(r"#(\p{L}[\p{L}\p{N}_/\-]*)").unwrap(),
            // Rust's `regex` crate has no backreferences, so (unlike the JS
            // side) this only handles single-backtick spans -- good enough
            // for masking `#tag`-shaped text out of inline code.
            code_span: Regex::new(r"`[^`\n]*`").unwrap(),
            fence: Regex::new(r"^(\s*)(`{3,}|~{3,})").unwrap(),
        }
    }

    /// Replaces inline code spans with spaces of the same byte length so
    /// match offsets on the (unused here) line stay meaningful.
    fn mask_inline_code(&self, line: &str) -> String {
        self.code_span
            .replace_all(line, |caps: &regex::Captures| " ".repeat(caps[0].len()))
            .into_owned()
    }

    fn tags_in_line(&self, line: &str) -> Vec<String> {
        let masked = self.mask_inline_code(line);
        let mut out = Vec::new();
        for m in self.tag.find_iter(&masked) {
            let preceding_ok = match masked[..m.start()].chars().next_back() {
                None => true,
                Some(c) => c.is_whitespace(),
            };
            if !preceding_ok {
                continue;
            }
            let raw = &masked[m.start() + 1..m.end()];
            let trimmed = raw.trim_end_matches(['/', '_', '-']);
            if trimmed.is_empty() {
                continue;
            }
            out.push(trimmed.to_string());
        }
        out
    }
}

/// Reads `tags:` from a note's YAML frontmatter (the `---`-delimited block
/// at the very start of the file). Supports an inline array
/// (`tags: [a, b]`), a block list (`tags:\n  - a`), and a space/comma
/// separated scalar line (`tags: a b`).
///
/// TODO(coordinator): replace with the frontmatter module's parser once it
/// lands (see issue #23) -- this is a minimal, swappable stand-in that
/// mirrors `frontmatterTags` in `src/modules/tags/lib/parseTags.ts`.
fn frontmatter_tags(content: &str) -> Vec<String> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.first().map(|l| l.trim()) != Some("---") {
        return Vec::new();
    }
    let Some(end) = lines
        .iter()
        .skip(1)
        .position(|l| l.trim() == "---")
        .map(|i| i + 1)
    else {
        return Vec::new();
    };
    let fm = &lines[1..end];

    for (i, line) in fm.iter().enumerate() {
        let Some(rest) = line.strip_prefix("tags:") else {
            continue;
        };
        let rest = rest.trim();

        if let Some(stripped) = rest.strip_prefix('[') {
            let mut arr_text = stripped.to_string();
            let mut j = i;
            while !arr_text.contains(']') && j + 1 < fm.len() {
                j += 1;
                arr_text.push(' ');
                arr_text.push_str(fm[j].trim());
            }
            let inner = match arr_text.find(']') {
                Some(idx) => &arr_text[..idx],
                None => &arr_text[..],
            };
            return inner
                .split(',')
                .map(|p| strip_quotes(p.trim()))
                .filter(|t| !t.is_empty())
                .collect();
        } else if rest.is_empty() {
            let mut tags = Vec::new();
            let mut j = i + 1;
            while j < fm.len() {
                let item_line = fm[j].trim_start();
                let Some(item) = item_line.strip_prefix('-') else {
                    break;
                };
                // Block-list items must be indented under the key.
                if fm[j].len() == item_line.len() {
                    break;
                }
                let t = strip_quotes(item.trim());
                if !t.is_empty() {
                    tags.push(t);
                }
                j += 1;
            }
            return tags;
        } else {
            let raw = strip_quotes(rest);
            return raw
                .split(|c: char| c.is_whitespace() || c == ',')
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }
    }

    Vec::new()
}

fn strip_quotes(s: &str) -> String {
    let bytes = s.as_bytes();
    if bytes.len() >= 2
        && ((bytes[0] == b'"' && bytes[bytes.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[bytes.len() - 1] == b'\''))
    {
        s[1..s.len() - 1].to_string()
    } else {
        s.to_string()
    }
}

fn normalize_tag(tag: &str) -> String {
    tag.trim_start_matches('#').trim().to_string()
}

/// Scans every Markdown file under `root` for inline `#tag` references
/// (skipping fenced code blocks / inline code spans) and frontmatter
/// `tags:` lists. Returns one entry per unique tag with the notes that
/// reference it, sorted by descending count then tag name.
#[tauri::command]
pub fn tags_scan(root: String) -> Result<Vec<TagEntry>, String> {
    let root_path = PathBuf::from(&root);
    let mut files = Vec::new();
    walk_markdown_files(&root_path, &mut files);

    let patterns = TagPatterns::new();
    // BTreeMap keeps iteration order stable/alphabetical before the final
    // sort, which keeps ties (equal counts) deterministic across runs.
    let mut by_tag: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for file in files {
        let Ok(content) = std::fs::read_to_string(&file) else {
            continue;
        };
        let file_str = to_canon(&file);

        let mut file_tags: Vec<String> = frontmatter_tags(&content)
            .iter()
            .map(|t| normalize_tag(t))
            .filter(|t| !t.is_empty())
            .collect();

        let mut in_fence = false;
        let mut fence_marker = '`';
        for raw_line in content.lines() {
            if let Some(caps) = patterns.fence.captures(raw_line) {
                let marker = caps[2].chars().next().unwrap();
                if !in_fence {
                    in_fence = true;
                    fence_marker = marker;
                } else if marker == fence_marker {
                    in_fence = false;
                }
                continue;
            }
            if in_fence {
                continue;
            }
            file_tags.extend(patterns.tags_in_line(raw_line));
        }

        file_tags.sort();
        file_tags.dedup();
        for tag in file_tags {
            by_tag.entry(tag).or_default().push(file_str.clone());
        }
    }

    let mut entries: Vec<TagEntry> = by_tag
        .into_iter()
        .map(|(tag, files)| TagEntry {
            count: files.len(),
            tag,
            files,
        })
        .collect();
    entries.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.tag.cmp(&b.tag)));

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scans_inline_and_frontmatter_tags() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.md"),
            "---\ntags: [alpha, beta]\n---\nbody with #beta and #gamma/nested\n",
        )
        .unwrap();
        std::fs::write(dir.path().join("b.md"), "just #alpha here\n").unwrap();

        let entries = tags_scan(dir.path().to_string_lossy().into_owned()).unwrap();
        let alpha = entries.iter().find(|e| e.tag == "alpha").unwrap();
        assert_eq!(alpha.count, 2);
        let beta = entries.iter().find(|e| e.tag == "beta").unwrap();
        assert_eq!(beta.count, 1);
        let gamma = entries.iter().find(|e| e.tag == "gamma/nested").unwrap();
        assert_eq!(gamma.count, 1);
    }

    #[test]
    fn ignores_headings_code_and_url_fragments() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.md"),
            "# Heading\n## Sub #real\nsee example.com/#frag\n```\n#fake\n```\nuse `#alsofake` here\n",
        )
        .unwrap();

        let entries = tags_scan(dir.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].tag, "real");
    }

    #[test]
    fn parses_block_list_frontmatter() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.md"), "---\ntags:\n  - one\n  - two\n---\n").unwrap();
        let entries = tags_scan(dir.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().any(|e| e.tag == "one"));
        assert!(entries.iter().any(|e| e.tag == "two"));
    }
}
