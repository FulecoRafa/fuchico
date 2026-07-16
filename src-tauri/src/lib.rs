mod modules;

use modules::fs::{file, mutate, tree};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().build())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
