use std::io::Write;
use std::path::{Path, PathBuf};

use regex::Regex;
use serde::Serialize;
use tempfile::NamedTempFile;

use super::fs::to_canon;

#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum ItemKind {
    /// `- [ ]` / `- [x]` markdown checkbox.
    Task,
    /// Bare `TODO:` line, not a checkbox.
    Todo,
    /// `📅 YYYY-MM-DD` line with no checkbox — calendar-only, not actionable.
    Event,
}

#[derive(Serialize)]
pub struct AgendaItem {
    pub kind: ItemKind,
    pub checked: bool,
    pub text: String,
    /// `YYYY-MM-DD`, if a `📅` date was found on the line.
    pub date: Option<String>,
    /// `HH:MM`, if present alongside the date.
    pub time: Option<String>,
    pub file: String,
    /// 1-based line number, for jump-to-line and toggling.
    pub line: usize,
    /// `daily` | `weekdays` | `weekends` | comma-separated weekday abbrevs
    /// (e.g. `mon,wed,fri`), if a `🔁` rule was found on the line.
    pub recurrence: Option<String>,
    /// `HH:MM`, if present alongside the recurrence rule.
    #[serde(rename = "recurTime")]
    pub recur_time: Option<String>,
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

struct Patterns {
    checkbox: Regex,
    todo: Regex,
    date: Regex,
    recur: Regex,
}

impl Patterns {
    fn new() -> Self {
        Self {
            checkbox: Regex::new(r"^[-*+]\s\[([ xX])\]\s*(.*)$").unwrap(),
            todo: Regex::new(r"(?i)^TODO:?\s+(.+)$").unwrap(),
            date: Regex::new(r"📅\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?").unwrap(),
            recur: Regex::new(
                r"(?i)🔁\s*(daily|weekdays|weekends|[a-z]{3}(?:,[a-z]{3})*)(?:\s+(\d{2}:\d{2}))?",
            )
            .unwrap(),
        }
    }

    fn extract_date(&self, text: &str) -> (Option<String>, Option<String>) {
        match self.date.captures(text) {
            Some(c) => (
                c.get(1).map(|m| m.as_str().to_string()),
                c.get(2).map(|m| m.as_str().to_string()),
            ),
            None => (None, None),
        }
    }

    fn extract_recurrence(&self, text: &str) -> (Option<String>, Option<String>) {
        match self.recur.captures(text) {
            Some(c) => (
                c.get(1).map(|m| m.as_str().to_lowercase()),
                c.get(2).map(|m| m.as_str().to_string()),
            ),
            None => (None, None),
        }
    }
}

/// Scans every Markdown file under `root` for task checkboxes, bare `TODO:`
/// lines, and `📅`-prefixed event lines. Convention:
///   - `- [ ] Buy milk 📅 2026-07-20` — task, optionally due-dated.
///   - `TODO: call the vet`            — todo, not toggleable.
///   - `📅 2026-07-22 10:00 Team sync` — event, calendar-only.
#[tauri::command]
pub fn tasks_scan(root: String) -> Result<Vec<AgendaItem>, String> {
    let root_path = PathBuf::from(&root);
    let mut files = Vec::new();
    walk_markdown_files(&root_path, &mut files);

    let patterns = Patterns::new();
    let mut items = Vec::new();

    for file in files {
        let Ok(content) = std::fs::read_to_string(&file) else {
            continue;
        };
        let file_str = to_canon(&file);

        for (idx, raw_line) in content.lines().enumerate() {
            let trimmed = raw_line.trim();
            if trimmed.is_empty() {
                continue;
            }

            if trimmed.starts_with('📅') {
                if let Some(m) = patterns.date.find(trimmed) {
                    let caps = patterns
                        .date
                        .captures(trimmed)
                        .expect("find implies captures");
                    let date = caps.get(1).map(|g| g.as_str().to_string());
                    let time = caps.get(2).map(|g| g.as_str().to_string());
                    let text = trimmed[m.end()..].trim().to_string();
                    items.push(AgendaItem {
                        kind: ItemKind::Event,
                        checked: false,
                        text,
                        date,
                        time,
                        file: file_str.clone(),
                        line: idx + 1,
                        recurrence: None,
                        recur_time: None,
                    });
                    continue;
                }
            }

            if let Some(caps) = patterns.checkbox.captures(trimmed) {
                let checked = matches!(&caps[1], "x" | "X");
                let text = caps[2].to_string();
                let (date, time) = patterns.extract_date(&text);
                let (recurrence, recur_time) = patterns.extract_recurrence(&text);
                items.push(AgendaItem {
                    kind: ItemKind::Task,
                    checked,
                    text,
                    date,
                    time,
                    file: file_str.clone(),
                    line: idx + 1,
                    recurrence,
                    recur_time,
                });
                continue;
            }

            if let Some(caps) = patterns.todo.captures(trimmed) {
                let text = caps[1].to_string();
                let (date, time) = patterns.extract_date(&text);
                let (recurrence, recur_time) = patterns.extract_recurrence(&text);
                items.push(AgendaItem {
                    kind: ItemKind::Todo,
                    checked: false,
                    text,
                    date,
                    time,
                    file: file_str.clone(),
                    line: idx + 1,
                    recurrence,
                    recur_time,
                });
            }
        }
    }

    Ok(items)
}

/// Flips `[ ]` <-> `[x]` on the given 1-based line of `path`. Errors if the
/// line isn't a checkbox (e.g. the file changed since the scan that produced
/// this line number).
#[tauri::command]
pub fn tasks_toggle(path: String, line: usize) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let content = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    if line == 0 || line > lines.len() {
        return Err("line out of range".to_string());
    }
    let idx = line - 1;

    let checkbox = Regex::new(r"^(\s*[-*+]\s\[)([ xX])(\]\s*.*)$").unwrap();
    let caps = checkbox
        .captures(&lines[idx])
        .ok_or_else(|| "line is not a checkbox".to_string())?;
    let new_state = if matches!(&caps[2], "x" | "X") {
        " "
    } else {
        "x"
    };
    lines[idx] = format!("{}{}{}", &caps[1], new_state, &caps[3]);

    let mut new_content = lines.join("\n");
    if content.ends_with('\n') {
        new_content.push('\n');
    }

    let parent = p.parent().ok_or_else(|| "path has no parent".to_string())?;
    let mut tmp = NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    tmp.as_file_mut()
        .write_all(new_content.as_bytes())
        .map_err(|e| e.to_string())?;
    tmp.as_file_mut().sync_all().map_err(|e| e.to_string())?;
    tmp.persist(&p).map_err(|e| e.error.to_string())?;

    Ok(())
}

#[cfg(test)]
mod scan_tests {
    use super::*;

    #[test]
    fn scans_tasks_todos_and_events() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.md"),
            "- [ ] one 📅 2026-07-20\n- [x] two\nTODO: three\n📅 2026-07-21 10:00 four\nplain text\n",
        )
        .unwrap();
        let items = tasks_scan(dir.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(items.len(), 4);
        assert!(matches!(items[0].kind, ItemKind::Task));
        assert_eq!(items[0].date.as_deref(), Some("2026-07-20"));
        assert!(!items[0].checked);
        assert!(matches!(items[1].kind, ItemKind::Task));
        assert!(items[1].checked);
        assert!(matches!(items[2].kind, ItemKind::Todo));
        assert_eq!(items[2].text, "three");
        assert!(matches!(items[3].kind, ItemKind::Event));
        assert_eq!(items[3].date.as_deref(), Some("2026-07-21"));
        assert_eq!(items[3].time.as_deref(), Some("10:00"));
        assert_eq!(items[3].text, "four");
    }

    #[test]
    fn scans_recurring_tasks() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.md"),
            "- [ ] give dog food 🔁 daily 08:00\n- [ ] trash 🔁 mon,wed,fri\nTODO: standup 🔁 weekdays\n- [ ] one-off\n",
        )
        .unwrap();
        let items = tasks_scan(dir.path().to_string_lossy().into_owned()).unwrap();
        assert_eq!(items.len(), 4);
        assert_eq!(items[0].recurrence.as_deref(), Some("daily"));
        assert_eq!(items[0].recur_time.as_deref(), Some("08:00"));
        assert_eq!(items[1].recurrence.as_deref(), Some("mon,wed,fri"));
        assert_eq!(items[1].recur_time, None);
        assert_eq!(items[2].recurrence.as_deref(), Some("weekdays"));
        assert_eq!(items[3].recurrence, None);
    }

    #[test]
    fn toggle_flips_checkbox_state() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("a.md");
        std::fs::write(&f, "- [ ] one\n- [x] two\n").unwrap();
        tasks_toggle(f.to_string_lossy().into_owned(), 1).unwrap();
        let content = std::fs::read_to_string(&f).unwrap();
        assert_eq!(content, "- [x] one\n- [x] two\n");
        tasks_toggle(f.to_string_lossy().into_owned(), 2).unwrap();
        let content = std::fs::read_to_string(&f).unwrap();
        assert_eq!(content, "- [x] one\n- [ ] two\n");
    }
}
