use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::modules::fs::file::write_atomic;

pub const SIDECAR_FILENAME: &str = ".fuchico-sync.json";

/// One task's sync identity within a linked folder. `file` is relative to
/// the folder root so the sidecar stays valid if the folder is moved/copied
/// as a unit. `line_hint` is a fast-path hint for the matcher, not a source
/// of truth -- any edit above the line shifts it, which is exactly why
/// `content_hash` (not the line) is the primary identity signal.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SidecarTask {
    pub uid: String,
    pub file: String,
    #[serde(rename = "lineHint")]
    pub line_hint: usize,
    /// Hash of the normalized task text (marker text stripped, see
    /// matcher.rs) -- the primary cross-edit identity signal.
    #[serde(rename = "contentHash")]
    pub content_hash: String,
    #[serde(rename = "lastText")]
    pub last_text: String,
    pub checked: bool,
    pub etag: Option<String>,
    #[serde(rename = "lastModifiedLocal")]
    pub last_modified_local: Option<DateTime<Utc>>,
    #[serde(rename = "lastModifiedRemote")]
    pub last_modified_remote: Option<DateTime<Utc>>,
    /// Set when a sidecar entry loses its match in a scan -- a soft-delete
    /// candidate. Cleared if it re-matches in a later scan. Only once this
    /// has persisted across `PENDING_DELETE_THRESHOLD` consecutive sync
    /// passes does the matcher treat it as a confirmed local deletion.
    #[serde(rename = "pendingDeleteSince", skip_serializing_if = "Option::is_none")]
    pub pending_delete_since: Option<DateTime<Utc>>,
    #[serde(rename = "pendingDeleteStreak", default)]
    pub pending_delete_streak: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Sidecar {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "calendarHref")]
    pub calendar_href: String,
    /// RFC 6578 sync-collection token, when the server supports incremental
    /// sync. v1's `client.rs` only implements full `calendar-query` REPORT,
    /// so this is currently always `None` -- reserved for a later
    /// optimization pass, not wired into the matcher yet.
    #[serde(rename = "syncToken", skip_serializing_if = "Option::is_none")]
    pub sync_token: Option<String>,
    #[serde(rename = "lastSyncedAt", skip_serializing_if = "Option::is_none")]
    pub last_synced_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub tasks: Vec<SidecarTask>,
}

impl Sidecar {
    pub fn new(account_id: impl Into<String>, calendar_href: impl Into<String>) -> Self {
        Self {
            account_id: account_id.into(),
            calendar_href: calendar_href.into(),
            sync_token: None,
            last_synced_at: None,
            tasks: Vec::new(),
        }
    }
}

pub fn sidecar_path(folder: &Path) -> PathBuf {
    folder.join(SIDECAR_FILENAME)
}

/// Returns `Ok(None)` if the folder has no sidecar yet (not linked, or
/// linked but never synced).
pub fn load(folder: &Path) -> Result<Option<Sidecar>, String> {
    let path = sidecar_path(folder);
    match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|e| format!("corrupt sidecar at {}: {e}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("failed to read {}: {e}", path.display())),
    }
}

pub fn save(folder: &Path, sidecar: &Sidecar) -> Result<(), String> {
    let path = sidecar_path(folder);
    let json = serde_json::to_vec_pretty(sidecar).map_err(|e| e.to_string())?;
    write_atomic(&path, &json).map_err(|e| format!("failed to write {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_task(uid: &str) -> SidecarTask {
        SidecarTask {
            uid: uid.to_string(),
            file: "Tasks.md".to_string(),
            line_hint: 3,
            content_hash: "abc123".to_string(),
            last_text: "Buy milk".to_string(),
            checked: false,
            etag: Some("\"e1\"".to_string()),
            last_modified_local: None,
            last_modified_remote: None,
            pending_delete_since: None,
            pending_delete_streak: 0,
        }
    }

    #[test]
    fn load_returns_none_when_no_sidecar_exists() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load(dir.path()).unwrap().is_none());
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let mut sidecar = Sidecar::new("acct-1", "https://example.com/cal/");
        sidecar.tasks.push(sample_task("uid-1"));

        save(dir.path(), &sidecar).unwrap();
        let loaded = load(dir.path()).unwrap().unwrap();
        assert_eq!(loaded.account_id, "acct-1");
        assert_eq!(loaded.tasks.len(), 1);
        assert_eq!(loaded.tasks[0].uid, "uid-1");
    }

    #[test]
    fn load_reports_corrupt_json_as_error_not_panic() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(sidecar_path(dir.path()), b"{ not json").unwrap();
        assert!(load(dir.path()).is_err());
    }

    #[test]
    fn sidecar_file_is_hidden() {
        assert!(SIDECAR_FILENAME.starts_with('.'));
    }
}
