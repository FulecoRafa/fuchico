use std::collections::HashSet;

use chrono::NaiveDate;
use regex::Regex;
use sha2::{Digest, Sha256};

use super::sidecar::SidecarTask;

/// A checkbox task as found by a filesystem scan of a linked folder --
/// deliberately narrower than `tasks::AgendaItem` (no todo/event variants;
/// v1 sync only touches `- [ ]`/`- [x]` lines, see the CalDAV sync plan).
#[derive(Debug, Clone, PartialEq)]
pub struct ScannedTask {
    /// Path relative to the linked folder root (matches `SidecarTask::file`).
    pub file: String,
    pub line: usize,
    /// Raw checkbox text, markers (`📅`/`🔁`) included.
    pub text: String,
    pub checked: bool,
}

/// Similarity below this is never considered a match, even with perfect
/// line proximity.
const SIMILARITY_THRESHOLD: f64 = 0.6;
/// A same-file fuzzy match within this many lines of its old `lineHint`
/// doesn't need to be the single best candidate in the file.
const PROXIMITY_WINDOW: i64 = 5;
/// Consecutive sync passes a sidecar entry must go unmatched before the
/// matcher reports it as a confirmed deletion (vs. a soft-delete candidate
/// that might still reappear after a misdetected reorder+rewrite).
pub const PENDING_DELETE_STREAK_THRESHOLD: u32 = 3;

fn date_marker() -> &'static Regex {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| Regex::new(r"📅\s*\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?").unwrap())
}

fn recur_marker() -> &'static Regex {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)🔁\s*(?:daily|weekdays|weekends|[a-z]{3}(?:,[a-z]{3})*)(?:\s+\d{2}:\d{2})?")
            .unwrap()
    })
}

fn date_capture() -> &'static Regex {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| Regex::new(r"📅\s*(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?").unwrap())
}

/// Strips the `📅 date`/`🔁 recurrence` markers and collapses whitespace, so
/// editing a task's date or recurrence alone doesn't change its identity
/// hash. Preserves case -- callers that need a case-insensitive identity
/// signal go through [`normalize_text`] instead.
pub fn strip_markers(text: &str) -> String {
    let no_date = date_marker().replace_all(text, "");
    let no_recur = recur_marker().replace_all(&no_date, "");
    no_recur.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// [`strip_markers`], additionally lowercased -- the identity-hash and
/// similarity input, where a pure-casing edit shouldn't break a match.
pub fn normalize_text(text: &str) -> String {
    strip_markers(text).to_lowercase()
}

/// Extracts the `📅 YYYY-MM-DD` due date, if present. v1 only pushes this
/// local -> remote (`VTODO DUE`); it is never pulled back from the server,
/// see the CalDAV sync plan's v1 scope note.
pub fn extract_due(text: &str) -> Option<NaiveDate> {
    let caps = date_capture().captures(text)?;
    NaiveDate::parse_from_str(&caps[1], "%Y-%m-%d").ok()
}

/// Re-finds the original (case-preserved) `📅`/`🔁` marker substrings in
/// `text`, for re-appending to a title pulled from the server -- v1 doesn't
/// sync due date/recurrence from remote, so a pull must not silently drop
/// the markers that were already on the local line.
pub fn extract_trailing_markers(text: &str) -> String {
    let mut parts = Vec::new();
    if let Some(m) = date_marker().find(text) {
        parts.push(m.as_str().to_string());
    }
    if let Some(m) = recur_marker().find(text) {
        parts.push(m.as_str().to_string());
    }
    parts.join(" ")
}

pub fn content_hash(text: &str) -> String {
    let normalized = normalize_text(text);
    let mut hasher = Sha256::new();
    hasher.update(normalized.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn token_set(text: &str) -> HashSet<String> {
    normalize_text(text)
        .split_whitespace()
        .map(|s| s.to_string())
        .collect()
}

/// Jaccard similarity over normalized whitespace tokens: `|A ∩ B| / |A ∪ B|`.
/// Cheap, dependency-free, and tolerant of word reordering -- sufficient for
/// the matcher's purposes since it only needs to distinguish "same task,
/// lightly edited" from "unrelated task", not rank fine-grained edits.
fn similarity(a: &str, b: &str) -> f64 {
    let ta = token_set(a);
    let tb = token_set(b);
    if ta.is_empty() && tb.is_empty() {
        return 1.0;
    }
    let intersection = ta.intersection(&tb).count();
    let union = ta.union(&tb).count();
    if union == 0 {
        0.0
    } else {
        intersection as f64 / union as f64
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MatchedPair {
    pub scanned_index: usize,
    pub sidecar_index: usize,
}

#[derive(Debug, Default)]
pub struct MatchOutput {
    pub matched: Vec<MatchedPair>,
    /// Scanned tasks with no sidecar match -- new tasks, need a UID and a
    /// CalDAV `PUT` create.
    pub new_scanned: Vec<usize>,
    /// Sidecar entries with no scanned match -- soft-delete candidates.
    pub unmatched_sidecar: Vec<usize>,
}

/// Cascading reconciliation between a folder's freshly scanned tasks and
/// its sidecar's last-known task set. Each stage only considers what the
/// previous stage left unmatched. See the CalDAV sync plan's "Algoritmo de
/// matching" section for the rationale behind each stage and its
/// documented limitation (heavy-edit + reorder in the same sync window is
/// indistinguishable from delete+create).
pub fn match_tasks(scanned: &[ScannedTask], sidecar: &[SidecarTask]) -> MatchOutput {
    let mut matched_scanned: Vec<bool> = vec![false; scanned.len()];
    let mut matched_sidecar: Vec<bool> = vec![false; sidecar.len()];
    let mut matched = Vec::new();

    // Stage 1: exact content-hash match within the same file.
    for (si, s) in scanned.iter().enumerate() {
        if matched_scanned[si] {
            continue;
        }
        let hash = content_hash(&s.text);
        if let Some(ti) = sidecar.iter().enumerate().position(|(ti, t)| {
            !matched_sidecar[ti] && t.file == s.file && t.content_hash == hash
        }) {
            matched_scanned[si] = true;
            matched_sidecar[ti] = true;
            matched.push(MatchedPair {
                scanned_index: si,
                sidecar_index: ti,
            });
        }
    }

    // Stage 2: fuzzy + proximity, same file only.
    fuzzy_match_within(
        scanned,
        sidecar,
        &mut matched_scanned,
        &mut matched_sidecar,
        &mut matched,
        true,
    );

    // Stage 3: fuzzy, whole folder (covers a file rename/move within the
    // linked folder).
    fuzzy_match_within(
        scanned,
        sidecar,
        &mut matched_scanned,
        &mut matched_sidecar,
        &mut matched,
        false,
    );

    let new_scanned = (0..scanned.len()).filter(|&i| !matched_scanned[i]).collect();
    let unmatched_sidecar = (0..sidecar.len()).filter(|&i| !matched_sidecar[i]).collect();

    MatchOutput {
        matched,
        new_scanned,
        unmatched_sidecar,
    }
}

/// One fuzzy-matching pass. `same_file_only` gates candidates to `s.file ==
/// t.file` (stage 2); when `false` it searches the whole sidecar (stage 3).
/// A candidate qualifies if its similarity clears [`SIMILARITY_THRESHOLD`]
/// **and** either its old line is within [`PROXIMITY_WINDOW`] of the
/// scanned line, or it is the single highest-similarity candidate among
/// this stage's eligible pool for that scanned task (unambiguous even
/// without proximity).
fn fuzzy_match_within(
    scanned: &[ScannedTask],
    sidecar: &[SidecarTask],
    matched_scanned: &mut [bool],
    matched_sidecar: &mut [bool],
    matched: &mut Vec<MatchedPair>,
    same_file_only: bool,
) {
    for si in 0..scanned.len() {
        if matched_scanned[si] {
            continue;
        }
        let s = &scanned[si];

        let mut candidates: Vec<(usize, f64)> = sidecar
            .iter()
            .enumerate()
            .filter(|(ti, t)| !matched_sidecar[*ti] && (!same_file_only || t.file == s.file))
            .map(|(ti, t)| (ti, similarity(&s.text, &t.last_text)))
            .filter(|(_, sim)| *sim >= SIMILARITY_THRESHOLD)
            .collect();

        if candidates.is_empty() {
            continue;
        }
        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        let best = candidates[0];
        let is_unique_best = candidates.len() == 1 || candidates[1].1 < best.1;
        let within_proximity =
            (sidecar[best.0].line_hint as i64 - s.line as i64).abs() <= PROXIMITY_WINDOW;

        if within_proximity || is_unique_best {
            matched_scanned[si] = true;
            matched_sidecar[best.0] = true;
            matched.push(MatchedPair {
                scanned_index: si,
                sidecar_index: best.0,
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scanned(file: &str, line: usize, text: &str, checked: bool) -> ScannedTask {
        ScannedTask {
            file: file.to_string(),
            line,
            text: text.to_string(),
            checked,
        }
    }

    fn sidecar_entry(uid: &str, file: &str, line_hint: usize, text: &str) -> SidecarTask {
        SidecarTask {
            uid: uid.to_string(),
            file: file.to_string(),
            line_hint,
            content_hash: content_hash(text),
            last_text: text.to_string(),
            checked: false,
            etag: None,
            last_modified_local: None,
            last_modified_remote: None,
            pending_delete_since: None,
            pending_delete_streak: 0,
        }
    }

    #[test]
    fn normalize_strips_date_and_recurrence_markers() {
        assert_eq!(
            normalize_text("Buy milk 📅 2026-07-20 🔁 daily 09:00"),
            "buy milk"
        );
    }

    #[test]
    fn exact_hash_match_survives_pure_checkbox_toggle() {
        let scanned_tasks = vec![scanned("Tasks.md", 3, "Buy milk", true)];
        let sidecar_tasks = vec![sidecar_entry("uid-1", "Tasks.md", 3, "Buy milk")];
        let out = match_tasks(&scanned_tasks, &sidecar_tasks);
        assert_eq!(out.matched, vec![MatchedPair { scanned_index: 0, sidecar_index: 0 }]);
        assert!(out.new_scanned.is_empty());
        assert!(out.unmatched_sidecar.is_empty());
    }

    #[test]
    fn exact_hash_match_ignores_date_marker_edits() {
        let scanned_tasks = vec![scanned("Tasks.md", 3, "Buy milk 📅 2026-08-01", false)];
        let sidecar_tasks = vec![sidecar_entry("uid-1", "Tasks.md", 3, "Buy milk 📅 2026-07-20")];
        let out = match_tasks(&scanned_tasks, &sidecar_tasks);
        assert_eq!(out.matched.len(), 1);
    }

    #[test]
    fn pure_reorder_matches_via_hash_regardless_of_line_shift() {
        let scanned_tasks = vec![
            scanned("Tasks.md", 1, "Call the vet", false),
            scanned("Tasks.md", 2, "Buy milk", false),
        ];
        let sidecar_tasks = vec![
            sidecar_entry("uid-milk", "Tasks.md", 1, "Buy milk"),
            sidecar_entry("uid-vet", "Tasks.md", 5, "Call the vet"),
        ];
        let out = match_tasks(&scanned_tasks, &sidecar_tasks);
        assert_eq!(out.matched.len(), 2);
        let vet_pair = out.matched.iter().find(|p| p.scanned_index == 0).unwrap();
        assert_eq!(sidecar_tasks[vet_pair.sidecar_index].uid, "uid-vet");
        let milk_pair = out.matched.iter().find(|p| p.scanned_index == 1).unwrap();
        assert_eq!(sidecar_tasks[milk_pair.sidecar_index].uid, "uid-milk");
    }

    #[test]
    fn pure_text_edit_matches_via_fuzzy_proximity() {
        let scanned_tasks = vec![scanned("Tasks.md", 3, "Buy oat milk", false)];
        let sidecar_tasks = vec![sidecar_entry("uid-1", "Tasks.md", 3, "Buy milk")];
        let out = match_tasks(&scanned_tasks, &sidecar_tasks);
        assert_eq!(out.matched.len(), 1);
    }

    #[test]
    fn edit_plus_reorder_matches_when_unique_high_similarity() {
        // Text changed AND moved far from its old line, but it's the only
        // plausible fuzzy candidate anywhere in the file.
        let scanned_tasks = vec![scanned("Tasks.md", 40, "Buy whole milk", false)];
        let sidecar_tasks = vec![
            sidecar_entry("uid-milk", "Tasks.md", 3, "Buy milk"),
            sidecar_entry("uid-vet", "Tasks.md", 4, "Call the vet"),
        ];
        let out = match_tasks(&scanned_tasks, &sidecar_tasks);
        assert_eq!(out.matched.len(), 1);
        assert_eq!(sidecar_tasks[out.matched[0].sidecar_index].uid, "uid-milk");
        assert_eq!(out.unmatched_sidecar, vec![1]);
    }

    #[test]
    fn unrelated_text_does_not_match_even_at_same_line() {
        let scanned_tasks = vec![scanned("Tasks.md", 3, "Schedule dentist appointment", false)];
        let sidecar_tasks = vec![sidecar_entry("uid-1", "Tasks.md", 3, "Buy milk")];
        let out = match_tasks(&scanned_tasks, &sidecar_tasks);
        assert!(out.matched.is_empty());
        assert_eq!(out.new_scanned, vec![0]);
        assert_eq!(out.unmatched_sidecar, vec![0]);
    }

    #[test]
    fn deleted_task_reports_as_unmatched_sidecar() {
        let scanned_tasks: Vec<ScannedTask> = vec![];
        let sidecar_tasks = vec![sidecar_entry("uid-1", "Tasks.md", 3, "Buy milk")];
        let out = match_tasks(&scanned_tasks, &sidecar_tasks);
        assert!(out.matched.is_empty());
        assert_eq!(out.unmatched_sidecar, vec![0]);
    }

    #[test]
    fn new_task_reports_as_new_scanned() {
        let scanned_tasks = vec![scanned("Tasks.md", 1, "Brand new task", false)];
        let sidecar_tasks: Vec<SidecarTask> = vec![];
        let out = match_tasks(&scanned_tasks, &sidecar_tasks);
        assert_eq!(out.new_scanned, vec![0]);
    }

    #[test]
    fn file_rename_matches_cross_file_by_fuzzy_search() {
        let scanned_tasks = vec![scanned("Renamed.md", 1, "Buy milk", false)];
        let sidecar_tasks = vec![sidecar_entry("uid-1", "Old.md", 1, "Buy milk")];
        let out = match_tasks(&scanned_tasks, &sidecar_tasks);
        assert_eq!(out.matched.len(), 1);
    }
}
