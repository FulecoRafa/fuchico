//! Files handed to the app by the OS (issue #38): double-clicking a `.md`
//! after Fuchico is the default handler, `open -a Fuchico note.md`, or a
//! path on the command line.
//!
//! macOS delivers them through `RunEvent::Opened` (possibly before the
//! webview exists); Linux/Windows pass them as argv, and a second launch is
//! forwarded here by the single-instance plugin. Either way the paths are
//! queued in [`OpenRequests`] and announced with `app:open-files`; the
//! frontend drains the queue once it is ready, so nothing is lost when the
//! event fires early.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, Runtime, State};

pub const OPEN_FILES_EVENT: &str = "app:open-files";

#[derive(Default)]
pub struct OpenRequests(Mutex<Vec<String>>);

/// Queues `paths` and notifies the main window.
pub fn push<R: Runtime>(app: &AppHandle<R>, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    if let Some(state) = app.try_state::<OpenRequests>() {
        let mut queue = state.0.lock().unwrap_or_else(|e| e.into_inner());
        queue.extend(paths.iter().cloned());
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.set_focus();
    }
    let _ = app.emit(OPEN_FILES_EVENT, paths);
}

/// Picks the file paths out of a process argument list. Flags are skipped;
/// relative paths are resolved against `cwd` so a shell `fuchico note.md`
/// works.
pub fn paths_from_args<I, S>(args: I, cwd: Option<&Path>) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .map(|a| a.as_ref().to_string())
        .filter(|a| !a.starts_with('-') && !a.is_empty())
        .filter_map(|a| {
            let p = PathBuf::from(&a);
            let p = if p.is_absolute() {
                p
            } else {
                cwd?.join(p)
            };
            p.is_file().then(|| p.to_string_lossy().into_owned())
        })
        .collect()
}

/// Returns and clears every queued path. Called by the frontend on startup.
#[tauri::command]
pub fn open_requests_take(state: State<'_, OpenRequests>) -> Vec<String> {
    let mut queue = state.0.lock().unwrap_or_else(|e| e.into_inner());
    std::mem::take(&mut *queue)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skips_flags_and_missing_files() {
        let dir = tempfile::tempdir().unwrap();
        let note = dir.path().join("note.md");
        std::fs::write(&note, "# hi").unwrap();
        let got = paths_from_args(
            ["--flag", "note.md", "missing.md", ""],
            Some(dir.path()),
        );
        assert_eq!(got, vec![note.to_string_lossy().into_owned()]);
    }

    #[test]
    fn relative_without_cwd_is_dropped() {
        assert!(paths_from_args(["note.md"], None).is_empty());
    }
}
