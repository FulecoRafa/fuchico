mod modules;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use modules::caldav::commands as caldav;
use modules::fonts;
use modules::fs::{file, mutate, tree};
use modules::links;
use modules::open_files;
use modules::search;
use modules::tags;
use modules::tasks;
use tauri::Listener;

/// How often the background poll reconciles every linked folder -- catches
/// changes made only on a phone/other device, since CalDAV has no push
/// notification mechanism available here.
const SYNC_POLL_INTERVAL: Duration = Duration::from_secs(15 * 60);

#[derive(serde::Deserialize)]
struct FileWrittenPayload {
    path: String,
    source: Option<String>,
}

/// Opens the OS print dialog for the calling window (issue #28); "Save as
/// PDF" lives there on every platform.
#[tauri::command]
fn export_print(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first. A second launch (Linux/Windows file
        // association, or `fuchico note.md` in a shell) hands its argv to the
        // running instance instead of opening a new one (issue #38).
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let paths =
                open_files::paths_from_args(args.iter().skip(1), Some(std::path::Path::new(&cwd)));
            open_files::push(app, paths);
        }))
        .manage(open_files::OpenRequests::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        // Remembers size/position per window label -- main, editor-*, mermaid-*
        // (issue #29).
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            let debounce_state: caldav::DebounceState = Arc::new(Mutex::new(Default::default()));

            {
                let app_handle = app.handle().clone();
                let debounce_state = debounce_state.clone();
                app.listen("fs:file-written", move |event| {
                    let Ok(payload) = serde_json::from_str::<FileWrittenPayload>(event.payload())
                    else {
                        return;
                    };
                    caldav::on_file_written(
                        app_handle.clone(),
                        debounce_state.clone(),
                        payload.path,
                        payload.source,
                    );
                });
            }

            {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    // Launch-time pass: pick up changes made elsewhere while
                    // the app was closed, before settling into the poll.
                    caldav::sync_all(&app_handle).await;

                    let mut interval = tokio::time::interval(SYNC_POLL_INTERVAL);
                    interval.tick().await; // first tick fires immediately; already synced above
                    loop {
                        interval.tick().await;
                        caldav::sync_all(&app_handle).await;
                    }
                });
            }

            // First launch with a file argument (Linux/Windows). macOS
            // delivers files through RunEvent::Opened below. The webview is
            // not up yet, so this only queues; the frontend drains the queue
            // via open_requests_take on startup.
            #[cfg(not(target_os = "macos"))]
            {
                let cwd = std::env::current_dir().ok();
                let paths =
                    open_files::paths_from_args(std::env::args().skip(1), cwd.as_deref());
                open_files::push(app.handle(), paths);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            file::fs_read_file,
            file::fs_write_file,
            file::fs_write_binary,
            file::fs_stat,
            file::fs_canonicalize,
            tree::fs_read_dir,
            tree::fs_list_markdown_files,
            mutate::fs_create_file,
            mutate::fs_create_dir,
            mutate::fs_rename,
            mutate::fs_delete,
            tasks::tasks_scan,
            tasks::tasks_toggle,
            tags::tags_scan,
            links::links_scan,
            export_print,
            search::search_files,
            search::search_replace_files,
            caldav::caldav_test_connection,
            caldav::caldav_discover_calendars,
            caldav::caldav_discover_calendars_for_account,
            caldav::caldav_save_account,
            caldav::caldav_list_accounts,
            caldav::caldav_remove_account,
            caldav::caldav_link_folder,
            caldav::caldav_unlink_folder,
            caldav::caldav_list_links,
            caldav::caldav_sync_now,
            caldav::caldav_get_sync_status,
            fonts::fonts_list_system,
            open_files::open_requests_take,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                let paths = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                open_files::push(app, paths);
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app, event);
            }
        });
}
