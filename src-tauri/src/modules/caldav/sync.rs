use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use regex::Regex;
use serde::Serialize;

use super::client::CalDavClient;
use super::ical::{self, SyncTask};
use super::matcher::{self, ScannedTask, PENDING_DELETE_STREAK_THRESHOLD};
use super::sidecar::{self, Sidecar, SidecarTask};
use crate::modules::fs::file::write_atomic;
use crate::modules::fs::to_canon;

const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", ".git"];
const SYNCED_TASKS_FILENAME: &str = "Synced Tasks.md";

#[derive(Serialize, Default, Debug)]
pub struct SyncReport {
    pub folder: String,
    #[serde(rename = "pushedNew")]
    pub pushed_new: usize,
    #[serde(rename = "pushedUpdated")]
    pub pushed_updated: usize,
    #[serde(rename = "pulledUpdated")]
    pub pulled_updated: usize,
    #[serde(rename = "pulledNew")]
    pub pulled_new: usize,
    #[serde(rename = "pendingDeletes")]
    pub pending_deletes: usize,
    #[serde(rename = "confirmedDeletesRemote")]
    pub confirmed_deletes_remote: usize,
    #[serde(rename = "deletedOnServer")]
    pub deleted_on_server: usize,
    #[serde(rename = "touchedFiles")]
    pub touched_files: Vec<String>,
    pub errors: Vec<String>,
}

/// A checkbox line as found on disk, with enough of the original raw line
/// preserved (indent, bullet, checkbox brackets) to reconstruct it exactly
/// after a pull-side edit. Mirrors the rewrite regex `tasks::tasks_toggle`
/// already uses, so sync's line edits look identical in style to a manual
/// toggle.
struct RawTask {
    /// Path relative to the linked folder root.
    file: String,
    /// 1-based.
    line: usize,
    /// Indent + bullet + `[`, e.g. `"  - ["`.
    prefix: String,
    /// `]` plus any spacer whitespace that followed it.
    bracket_spacer: String,
    /// Trailing text after the checkbox brackets, markers included.
    text: String,
    checked: bool,
}

fn checkbox_re() -> &'static Regex {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(\s*[-*+]\s\[)([ xX])(\]\s*)(.*)$").unwrap())
}

fn walk_and_scan(root: &Path, rel_dir: &Path, out: &mut Vec<RawTask>) {
    let dir = root.join(rel_dir);
    let Ok(read) = std::fs::read_dir(&dir) else {
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
            // A subfolder with its own sidecar is a separately linked
            // folder -- per the plan, the more specific link wins, so the
            // parent scan must not descend into it (would otherwise double
            // sync the same tasks into two calendars).
            if path.join(sidecar::SIDECAR_FILENAME).exists() {
                continue;
            }
            walk_and_scan(root, &rel_dir.join(&name), out);
        } else if ft.is_file() {
            let is_md = path
                .extension()
                .and_then(|e| e.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown"));
            if is_md {
                scan_file(root, &rel_dir.join(&name), out);
            }
        }
    }
}

fn scan_file(root: &Path, rel_path: &Path, out: &mut Vec<RawTask>) {
    let Ok(content) = std::fs::read_to_string(root.join(rel_path)) else {
        return;
    };
    let file_rel = to_canon(rel_path);
    for (idx, line) in content.lines().enumerate() {
        let Some(caps) = checkbox_re().captures(line) else {
            continue;
        };
        out.push(RawTask {
            file: file_rel.clone(),
            line: idx + 1,
            prefix: caps[1].to_string(),
            bracket_spacer: caps[3].to_string(),
            text: caps[4].to_string(),
            checked: matches!(&caps[2], "x" | "X"),
        });
    }
}

fn file_mtime(root: &Path, rel_file: &str) -> DateTime<Utc> {
    std::fs::metadata(root.join(rel_file))
        .and_then(|m| m.modified())
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(|_| Utc::now())
}

fn ensure_trailing_slash(url: &str) -> String {
    if url.ends_with('/') {
        url.to_string()
    } else {
        format!("{url}/")
    }
}

/// One full reconciliation pass for a linked folder: scans local checkbox
/// tasks, fetches the calendar's current `VTODO`s, reconciles them via
/// `matcher::match_tasks`, pushes/pulls/creates/soft-deletes as needed, and
/// persists the updated sidecar. See the CalDAV sync plan's "Algoritmo de
/// matching" and "Gatilhos de sync" sections for the rules this implements.
///
/// Callers own emitting `fs:file-written` for each of the returned
/// `touched_files` -- this function has no `AppHandle` and does no
/// emitting itself, to stay testable without a running Tauri app.
pub async fn sync_folder(
    client: &CalDavClient,
    folder: &Path,
    account_id: &str,
    calendar_href: &str,
    calendar_display_name: &str,
) -> Result<SyncReport, String> {
    let mut report = SyncReport {
        folder: to_canon(folder),
        ..Default::default()
    };

    let mut raw_tasks = Vec::new();
    walk_and_scan(folder, Path::new(""), &mut raw_tasks);
    let scanned: Vec<ScannedTask> = raw_tasks
        .iter()
        .map(|r| ScannedTask {
            file: r.file.clone(),
            line: r.line,
            text: r.text.clone(),
            checked: r.checked,
        })
        .collect();

    let mut sc = sidecar::load(folder)?.unwrap_or_else(|| Sidecar::new(account_id, calendar_href));
    sc.account_id = account_id.to_string();
    sc.calendar_href = calendar_href.to_string();

    let remote_responses = client
        .list_vtodos(calendar_href)
        .await
        .map_err(|e| e.to_string())?;
    let mut remote_by_uid: HashMap<String, (String, Option<String>, SyncTask)> = HashMap::new();
    for r in &remote_responses {
        let Some(cd) = &r.calendar_data else { continue };
        match ical::parse_vtodos(cd) {
            Ok(tasks) => {
                for t in tasks {
                    remote_by_uid.insert(t.uid.clone(), (client.resolve(&r.href), r.etag.clone(), t));
                }
            }
            Err(e) => report.errors.push(format!("bad VTODO at {}: {e}", r.href)),
        }
    }

    let match_out = matcher::match_tasks(&scanned, &sc.tasks);

    let mut new_sidecar_tasks: Vec<SidecarTask> = Vec::new();
    let mut consumed_remote_uids: HashSet<String> = HashSet::new();
    let mut file_edits: HashMap<String, Vec<(usize, String)>> = HashMap::new();

    for pair in &match_out.matched {
        let raw = &raw_tasks[pair.scanned_index];
        let old_entry = &sc.tasks[pair.sidecar_index];

        match remote_by_uid.get(&old_entry.uid) {
            None => {
                // Deleted server-side: per the plan, drop the sidecar link
                // and log it, but never touch the markdown line.
                report.deleted_on_server += 1;
            }
            Some((href, etag, remote_task)) => {
                consumed_remote_uids.insert(old_entry.uid.clone());
                let mut entry = old_entry.clone();

                let local_changed = matcher::normalize_text(&raw.text) != matcher::normalize_text(&old_entry.last_text)
                    || raw.checked != old_entry.checked;
                let remote_changed = etag.as_deref() != old_entry.etag.as_deref();

                if local_changed && remote_changed {
                    let remote_time = remote_task.last_modified.unwrap_or(DateTime::<Utc>::MIN_UTC);
                    let local_time = file_mtime(folder, &raw.file);
                    if remote_time > local_time {
                        pull_into(&mut entry, remote_task, etag, raw, &mut file_edits, &mut report);
                    } else {
                        push_update(client, &mut entry, raw, old_entry.etag.as_deref(), href, &mut report).await;
                    }
                } else if local_changed {
                    push_update(client, &mut entry, raw, old_entry.etag.as_deref(), href, &mut report).await;
                } else if remote_changed {
                    pull_into(&mut entry, remote_task, etag, raw, &mut file_edits, &mut report);
                } else {
                    entry.file = raw.file.clone();
                    entry.line_hint = raw.line;
                }
                entry.pending_delete_since = None;
                entry.pending_delete_streak = 0;
                new_sidecar_tasks.push(entry);
            }
        }
    }

    for &si in &match_out.new_scanned {
        let raw = &raw_tasks[si];
        let uid = uuid::Uuid::new_v4().to_string();
        let ics = ical::to_vtodo_ics(&SyncTask {
            uid: uid.clone(),
            summary: matcher::strip_markers(&raw.text),
            completed: raw.checked,
            due: matcher::extract_due(&raw.text),
            last_modified: None,
        });
        let url = format!("{}{uid}.ics", ensure_trailing_slash(calendar_href));
        match client.put_ics(&url, &ics, None).await {
            Ok(etag) => {
                report.pushed_new += 1;
                new_sidecar_tasks.push(SidecarTask {
                    uid,
                    file: raw.file.clone(),
                    line_hint: raw.line,
                    content_hash: matcher::content_hash(&raw.text),
                    last_text: raw.text.clone(),
                    checked: raw.checked,
                    etag,
                    last_modified_local: Some(Utc::now()),
                    last_modified_remote: Some(Utc::now()),
                    pending_delete_since: None,
                    pending_delete_streak: 0,
                });
            }
            Err(e) => report
                .errors
                .push(format!("failed to create remote task for {}:{}: {e}", raw.file, raw.line)),
        }
    }

    for &ti in &match_out.unmatched_sidecar {
        let mut entry = sc.tasks[ti].clone();
        consumed_remote_uids.insert(entry.uid.clone());
        entry.pending_delete_streak += 1;
        if entry.pending_delete_since.is_none() {
            entry.pending_delete_since = Some(Utc::now());
        }
        if entry.pending_delete_streak >= PENDING_DELETE_STREAK_THRESHOLD {
            let delete_result = match remote_by_uid.get(&entry.uid) {
                Some((href, _, _)) => client.delete(href).await.map_err(|e| e.to_string()),
                None => Ok(()),
            };
            match delete_result {
                Ok(()) => report.confirmed_deletes_remote += 1,
                Err(e) => {
                    report
                        .errors
                        .push(format!("failed to delete remote task {}: {e}", entry.uid));
                    new_sidecar_tasks.push(entry);
                }
            }
        } else {
            report.pending_deletes += 1;
            new_sidecar_tasks.push(entry);
        }
    }

    let mut new_from_remote: Vec<&SyncTask> = Vec::new();
    for (uid, (_, etag, remote_task)) in remote_by_uid.iter() {
        if consumed_remote_uids.contains(uid) || sc.tasks.iter().any(|t| &t.uid == uid) {
            continue;
        }
        new_from_remote.push(remote_task);
        new_sidecar_tasks.push(SidecarTask {
            uid: uid.clone(),
            file: SYNCED_TASKS_FILENAME.to_string(),
            line_hint: 0,
            content_hash: matcher::content_hash(&remote_task.summary),
            last_text: remote_task.summary.clone(),
            checked: remote_task.completed,
            etag: etag.clone(),
            last_modified_local: Some(Utc::now()),
            last_modified_remote: remote_task.last_modified,
            pending_delete_since: None,
            pending_delete_streak: 0,
        });
        report.pulled_new += 1;
    }
    if !new_from_remote.is_empty() {
        append_new_remote_tasks(folder, calendar_display_name, &new_from_remote, &mut report)?;
    }

    apply_file_edits(folder, file_edits, &mut report)?;

    sc.tasks = new_sidecar_tasks;
    sc.last_synced_at = Some(Utc::now());
    sidecar::save(folder, &sc)?;

    Ok(report)
}

fn pull_into(
    entry: &mut SidecarTask,
    remote_task: &SyncTask,
    etag: &Option<String>,
    raw: &RawTask,
    file_edits: &mut HashMap<String, Vec<(usize, String)>>,
    report: &mut SyncReport,
) {
    let trailing_markers = matcher::extract_trailing_markers(&raw.text);
    let new_text = if trailing_markers.is_empty() {
        remote_task.summary.clone()
    } else {
        format!("{} {trailing_markers}", remote_task.summary)
    };
    let checkchar = if remote_task.completed { "x" } else { " " };
    let new_line = format!("{}{checkchar}{}{new_text}", raw.prefix, raw.bracket_spacer);
    file_edits.entry(raw.file.clone()).or_default().push((raw.line, new_line));

    entry.file = raw.file.clone();
    entry.line_hint = raw.line;
    entry.last_text = new_text;
    entry.checked = remote_task.completed;
    entry.content_hash = matcher::content_hash(&entry.last_text);
    entry.etag = etag.clone();
    entry.last_modified_remote = remote_task.last_modified;
    entry.last_modified_local = Some(Utc::now());
    report.pulled_updated += 1;
}

async fn push_update(
    client: &CalDavClient,
    entry: &mut SidecarTask,
    raw: &RawTask,
    old_etag: Option<&str>,
    href: &str,
    report: &mut SyncReport,
) {
    let ics = ical::to_vtodo_ics(&SyncTask {
        uid: entry.uid.clone(),
        summary: matcher::strip_markers(&raw.text),
        completed: raw.checked,
        due: matcher::extract_due(&raw.text),
        last_modified: None,
    });
    match client.put_ics(href, &ics, old_etag).await {
        Ok(new_etag) => {
            entry.file = raw.file.clone();
            entry.line_hint = raw.line;
            entry.last_text = raw.text.clone();
            entry.checked = raw.checked;
            entry.content_hash = matcher::content_hash(&raw.text);
            entry.etag = new_etag.or_else(|| old_etag.map(str::to_string));
            entry.last_modified_local = Some(Utc::now());
            entry.last_modified_remote = Some(Utc::now());
            report.pushed_updated += 1;
        }
        Err(e) => report
            .errors
            .push(format!("failed to push update for {}:{}: {e}", raw.file, raw.line)),
    }
}

/// Appends newly-discovered remote tasks to `<folder>/Synced Tasks.md`
/// under a `## <calendar display name>` heading, creating the file/heading
/// if needed. v1 always appends at end-of-file rather than inserting under
/// an existing heading occurrence -- a documented simplification, not a
/// correctness issue, since the heading-dedup check still prevents
/// duplicate headings across repeated syncs.
fn append_new_remote_tasks(
    folder: &Path,
    calendar_display_name: &str,
    new_tasks: &[&SyncTask],
    report: &mut SyncReport,
) -> Result<(), String> {
    let path = folder.join(SYNCED_TASKS_FILENAME);
    let mut content = std::fs::read_to_string(&path).unwrap_or_default();
    let heading = format!("## {calendar_display_name}");
    if !content.contains(&heading) {
        if !content.is_empty() && !content.ends_with('\n') {
            content.push('\n');
        }
        if !content.is_empty() {
            content.push('\n');
        }
        content.push_str(&heading);
        content.push('\n');
    }
    for task in new_tasks {
        let checkchar = if task.completed { "x" } else { " " };
        content.push_str(&format!("- [{checkchar}] {}\n", task.summary));
    }
    write_atomic(&path, content.as_bytes()).map_err(|e| format!("failed to write {}: {e}", path.display()))?;
    report.touched_files.push(to_canon(&path));
    Ok(())
}

fn apply_file_edits(
    folder: &Path,
    file_edits: HashMap<String, Vec<(usize, String)>>,
    report: &mut SyncReport,
) -> Result<(), String> {
    for (rel_file, edits) in file_edits {
        let abs: PathBuf = folder.join(&rel_file);
        let content = std::fs::read_to_string(&abs).map_err(|e| format!("failed to read {}: {e}", abs.display()))?;
        let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        for (line, new_text) in edits {
            if line == 0 || line > lines.len() {
                continue;
            }
            lines[line - 1] = new_text;
        }
        let mut new_content = lines.join("\n");
        if content.ends_with('\n') {
            new_content.push('\n');
        }
        write_atomic(&abs, new_content.as_bytes()).map_err(|e| format!("failed to write {}: {e}", abs.display()))?;
        if !report.touched_files.contains(&to_canon(&abs)) {
            report.touched_files.push(to_canon(&abs));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path_regex};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    const EMPTY_REPORT: &str = "<?xml version=\"1.0\"?><multistatus xmlns=\"DAV:\"></multistatus>";

    fn write_file(dir: &Path, name: &str, content: &str) {
        std::fs::write(dir.join(name), content).unwrap();
    }

    fn report_body_for(href: &str, etag: &str, uid: &str, summary: &str, completed: bool) -> String {
        let status = if completed { "COMPLETED" } else { "NEEDS-ACTION" };
        format!(
            "<?xml version=\"1.0\"?>\n<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\">\n  <response>\n    <href>{href}</href>\n    <propstat>\n      <prop>\n        <getetag>{etag}</getetag>\n        <C:calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:{uid}\r\nSUMMARY:{summary}\r\nSTATUS:{status}\r\nEND:VTODO\r\nEND:VCALENDAR\r\n</C:calendar-data>\n      </prop>\n      <status>HTTP/1.1 200 OK</status>\n    </propstat>\n  </response>\n</multistatus>"
        )
    }

    #[tokio::test]
    async fn new_local_task_is_pushed_and_recorded_in_sidecar() {
        let dir = tempfile::tempdir().unwrap();
        write_file(dir.path(), "Tasks.md", "- [ ] Buy milk 📅 2026-08-01\n");

        let server = MockServer::start().await;
        Mock::given(method("REPORT"))
            .respond_with(ResponseTemplate::new(207).set_body_string(EMPTY_REPORT))
            .mount(&server)
            .await;
        Mock::given(method("PUT"))
            .respond_with(ResponseTemplate::new(201).insert_header("ETag", "\"e1\""))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "u", "p");
        let calendar_url = format!("{}/cal/", server.uri());
        let report = sync_folder(&client, dir.path(), "acct-1", &calendar_url, "Reminders")
            .await
            .unwrap();

        assert_eq!(report.pushed_new, 1);
        assert!(report.errors.is_empty());

        let sc = sidecar::load(dir.path()).unwrap().unwrap();
        assert_eq!(sc.tasks.len(), 1);
        assert_eq!(sc.tasks[0].last_text, "Buy milk 📅 2026-08-01");
        assert_eq!(sc.tasks[0].etag.as_deref(), Some("\"e1\""));
    }

    #[tokio::test]
    async fn checkbox_toggle_pushes_an_update_with_if_match() {
        let dir = tempfile::tempdir().unwrap();
        write_file(dir.path(), "Tasks.md", "- [x] Buy milk\n");

        let mut sc = Sidecar::new("acct-1", "https://x/cal/");
        sc.tasks.push(SidecarTask {
            uid: "uid-1".to_string(),
            file: "Tasks.md".to_string(),
            line_hint: 1,
            content_hash: matcher::content_hash("Buy milk"),
            last_text: "Buy milk".to_string(),
            checked: false,
            etag: Some("\"old\"".to_string()),
            last_modified_local: None,
            last_modified_remote: None,
            pending_delete_since: None,
            pending_delete_streak: 0,
        });
        sidecar::save(dir.path(), &sc).unwrap();

        let report_body = report_body_for("/cal/uid-1.ics", "\"old\"", "uid-1", "Buy milk", false);

        let server = MockServer::start().await;
        Mock::given(method("REPORT"))
            .respond_with(ResponseTemplate::new(207).set_body_string(report_body))
            .mount(&server)
            .await;
        Mock::given(method("PUT"))
            .and(path_regex(".*uid-1.*"))
            .respond_with(ResponseTemplate::new(204).insert_header("ETag", "\"new\""))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "u", "p");
        let calendar_url = format!("{}/cal/", server.uri());
        let report = sync_folder(&client, dir.path(), "acct-1", &calendar_url, "Reminders")
            .await
            .unwrap();

        assert_eq!(report.pushed_updated, 1);
        let sc = sidecar::load(dir.path()).unwrap().unwrap();
        assert!(sc.tasks[0].checked);
        assert_eq!(sc.tasks[0].etag.as_deref(), Some("\"new\""));
    }

    #[tokio::test]
    async fn remote_only_task_is_appended_to_synced_tasks_file() {
        let dir = tempfile::tempdir().unwrap();
        let report_body = "<?xml version=\"1.0\"?>\n<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\">\n  <response>\n    <href>/cal/new.ics</href>\n    <propstat>\n      <prop>\n        <getetag>\"r1\"</getetag>\n        <C:calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:remote-uid\r\nSUMMARY:Call the vet\r\nEND:VTODO\r\nEND:VCALENDAR\r\n</C:calendar-data>\n      </prop>\n      <status>HTTP/1.1 200 OK</status>\n    </propstat>\n  </response>\n</multistatus>";

        let server = MockServer::start().await;
        Mock::given(method("REPORT"))
            .respond_with(ResponseTemplate::new(207).set_body_string(report_body))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "u", "p");
        let calendar_url = format!("{}/cal/", server.uri());
        let report = sync_folder(&client, dir.path(), "acct-1", &calendar_url, "Reminders")
            .await
            .unwrap();

        assert_eq!(report.pulled_new, 1);
        let synced = std::fs::read_to_string(dir.path().join(SYNCED_TASKS_FILENAME)).unwrap();
        assert!(synced.contains("## Reminders"));
        assert!(synced.contains("- [ ] Call the vet"));

        let sc = sidecar::load(dir.path()).unwrap().unwrap();
        assert_eq!(sc.tasks.len(), 1);
        assert_eq!(sc.tasks[0].uid, "remote-uid");
    }

    #[tokio::test]
    async fn local_deletion_needs_a_streak_before_confirming_remote_delete() {
        let dir = tempfile::tempdir().unwrap();
        // No local file at all -- the sidecar task has nothing to match.

        let mut sc = Sidecar::new("acct-1", "https://x/cal/");
        sc.tasks.push(SidecarTask {
            uid: "uid-gone".to_string(),
            file: "Tasks.md".to_string(),
            line_hint: 1,
            content_hash: matcher::content_hash("Buy milk"),
            last_text: "Buy milk".to_string(),
            checked: false,
            etag: Some("\"e\"".to_string()),
            last_modified_local: None,
            last_modified_remote: None,
            pending_delete_since: None,
            pending_delete_streak: 0,
        });
        sidecar::save(dir.path(), &sc).unwrap();

        let server = MockServer::start().await;
        Mock::given(method("REPORT"))
            .respond_with(ResponseTemplate::new(207).set_body_string(EMPTY_REPORT))
            .mount(&server)
            .await;
        Mock::given(method("DELETE"))
            .respond_with(ResponseTemplate::new(204))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "u", "p");
        let calendar_url = format!("{}/cal/", server.uri());

        for _ in 0..PENDING_DELETE_STREAK_THRESHOLD - 1 {
            let report = sync_folder(&client, dir.path(), "acct-1", &calendar_url, "Reminders")
                .await
                .unwrap();
            assert_eq!(report.pending_deletes, 1);
            assert_eq!(report.confirmed_deletes_remote, 0);
        }

        let final_report = sync_folder(&client, dir.path(), "acct-1", &calendar_url, "Reminders")
            .await
            .unwrap();
        assert_eq!(final_report.confirmed_deletes_remote, 1);
        let sc = sidecar::load(dir.path()).unwrap().unwrap();
        assert!(sc.tasks.is_empty());
    }

    #[tokio::test]
    async fn deleted_on_server_drops_sidecar_link_without_touching_markdown() {
        let dir = tempfile::tempdir().unwrap();
        write_file(dir.path(), "Tasks.md", "- [ ] Buy milk\n");

        let mut sc = Sidecar::new("acct-1", "https://x/cal/");
        sc.tasks.push(SidecarTask {
            uid: "uid-1".to_string(),
            file: "Tasks.md".to_string(),
            line_hint: 1,
            content_hash: matcher::content_hash("Buy milk"),
            last_text: "Buy milk".to_string(),
            checked: false,
            etag: Some("\"e\"".to_string()),
            last_modified_local: None,
            last_modified_remote: None,
            pending_delete_since: None,
            pending_delete_streak: 0,
        });
        sidecar::save(dir.path(), &sc).unwrap();

        let server = MockServer::start().await;
        // REPORT returns nothing for uid-1 -- it's gone server-side.
        Mock::given(method("REPORT"))
            .respond_with(ResponseTemplate::new(207).set_body_string(EMPTY_REPORT))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "u", "p");
        let calendar_url = format!("{}/cal/", server.uri());
        let report = sync_folder(&client, dir.path(), "acct-1", &calendar_url, "Reminders")
            .await
            .unwrap();

        assert_eq!(report.deleted_on_server, 1);
        assert!(report.touched_files.is_empty());
        assert_eq!(
            std::fs::read_to_string(dir.path().join("Tasks.md")).unwrap(),
            "- [ ] Buy milk\n"
        );
        let sc = sidecar::load(dir.path()).unwrap().unwrap();
        assert!(sc.tasks.is_empty());
    }

    #[tokio::test]
    async fn nested_linked_subfolder_is_not_double_scanned() {
        let dir = tempfile::tempdir().unwrap();
        write_file(dir.path(), "Tasks.md", "- [ ] Parent task\n");
        std::fs::create_dir(dir.path().join("sub")).unwrap();
        write_file(&dir.path().join("sub"), "Tasks.md", "- [ ] Nested task\n");
        // Marks `sub/` as its own linked folder.
        sidecar::save(&dir.path().join("sub"), &Sidecar::new("acct-2", "https://x/other/")).unwrap();

        let server = MockServer::start().await;
        Mock::given(method("REPORT"))
            .respond_with(ResponseTemplate::new(207).set_body_string(EMPTY_REPORT))
            .mount(&server)
            .await;
        Mock::given(method("PUT"))
            .respond_with(ResponseTemplate::new(201).insert_header("ETag", "\"e1\""))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "u", "p");
        let calendar_url = format!("{}/cal/", server.uri());
        let report = sync_folder(&client, dir.path(), "acct-1", &calendar_url, "Reminders")
            .await
            .unwrap();

        assert_eq!(report.pushed_new, 1);
        let sc = sidecar::load(dir.path()).unwrap().unwrap();
        assert_eq!(sc.tasks.len(), 1);
        assert_eq!(sc.tasks[0].last_text, "Parent task");
    }
}
