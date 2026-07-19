mod modules;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use modules::caldav::commands as caldav;
use modules::fonts;
use modules::fs::{file, mutate, tree};
use modules::search;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().build())
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            file::fs_read_file,
            file::fs_write_file,
            file::fs_stat,
            file::fs_canonicalize,
            tree::fs_read_dir,
            mutate::fs_create_file,
            mutate::fs_create_dir,
            mutate::fs_rename,
            mutate::fs_delete,
            tasks::tasks_scan,
            tasks::tasks_toggle,
            search::search_files,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
