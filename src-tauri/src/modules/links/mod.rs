use std::path::{Path, PathBuf};

use regex::Regex;
use serde::Serialize;

use super::fs::to_canon;

/// One outgoing link found in a note (issue #21). Resolution of `target`
/// to a vault file happens in the frontend (`resolveWikilinkTarget` /
/// `resolveRelativeMarkdownLink`), which already owns those rules.
#[derive(Serialize, Debug, PartialEq)]
pub struct LinkRef {
    /// Absolute path of the note containing the link.
    pub path: String,
    /// 1-based line number.
    pub line: usize,
    /// Raw link target: the inside of `[[...]]` (alias kept) or the href of
    /// a `[text](href)` Markdown link.
    pub target: String,
    pub kind: LinkKind,
    /// The trimmed line the link appears on, for context in the panel.
    pub context: String,
}

#[derive(Serialize, Debug, PartialEq, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum LinkKind {
    Wiki,
    Markdown,
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
            if !SKIP_DIRS.contains(&name_str.as_ref()) {
                walk_markdown_files(&path, out);
            }
        } else if ft.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown") {
                    out.push(path);
                }
            }
        }
    }
}

struct LinkPatterns {
    wiki: Regex,
    markdown: Regex,
    fence: Regex,
    code_span: Regex,
}

impl LinkPatterns {
    fn new() -> Self {
        Self {
            wiki: Regex::new(r"\[\[([^\[\]]+?)\]\]").unwrap(),
            // `[text](href)` but not `![alt](img)`; href up to the first `)`
            // or space (titles are dropped).
            markdown: Regex::new(r#"(?:^|[^!])\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)"#)
                .unwrap(),
            fence: Regex::new(r"^\s*(`{3,}|~{3,})").unwrap(),
            code_span: Regex::new(r"`[^`]*`").unwrap(),
        }
    }
}

fn is_external(href: &str) -> bool {
    href.starts_with("//")
        || href
            .split_once(':')
            .map(|(scheme, _)| {
                !scheme.is_empty()
                    && scheme
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '.' || c == '-')
            })
            .unwrap_or(false)
}

fn scan_text(path: &str, content: &str, patterns: &LinkPatterns, out: &mut Vec<LinkRef>) {
    let mut in_fence = false;
    for (i, raw_line) in content.lines().enumerate() {
        if patterns.fence.is_match(raw_line) {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        let line = patterns.code_span.replace_all(raw_line, "");
        let context = raw_line.trim().to_string();
        for caps in patterns.wiki.captures_iter(&line) {
            out.push(LinkRef {
                path: path.to_string(),
                line: i + 1,
                target: caps[1].to_string(),
                kind: LinkKind::Wiki,
                context: context.clone(),
            });
        }
        for caps in patterns.markdown.captures_iter(&line) {
            let href = &caps[1];
            if href.starts_with('#') || is_external(href) {
                continue;
            }
            out.push(LinkRef {
                path: path.to_string(),
                line: i + 1,
                target: href.to_string(),
                kind: LinkKind::Markdown,
                context: context.clone(),
            });
        }
    }
}

/// Every wikilink and relative Markdown link in every note under `root`
/// (fenced code and inline code spans skipped).
#[tauri::command]
pub fn links_scan(root: String) -> Result<Vec<LinkRef>, String> {
    let mut files = Vec::new();
    walk_markdown_files(&PathBuf::from(&root), &mut files);
    let patterns = LinkPatterns::new();
    let mut out = Vec::new();
    for file in files {
        let Ok(content) = std::fs::read_to_string(&file) else {
            continue;
        };
        scan_text(&to_canon(&file), &content, &patterns, &mut out);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scan(text: &str) -> Vec<LinkRef> {
        let mut out = Vec::new();
        scan_text("/v/a.md", text, &LinkPatterns::new(), &mut out);
        out
    }

    #[test]
    fn finds_wiki_and_relative_markdown_links() {
        let refs = scan("see [[Note B|alias]] and [x](./c.md)\n[ext](https://x.y)\n![img](i.png)");
        assert_eq!(refs.len(), 2);
        assert_eq!(refs[0].target, "Note B|alias");
        assert_eq!(refs[0].kind, LinkKind::Wiki);
        assert_eq!(refs[0].line, 1);
        assert_eq!(refs[1].target, "./c.md");
        assert_eq!(refs[1].kind, LinkKind::Markdown);
    }

    #[test]
    fn skips_code() {
        let refs = scan("`[[no]]`\n```\n[[no]]\n```\n[[yes]]");
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].target, "yes");
        assert_eq!(refs[0].line, 5);
    }
}
