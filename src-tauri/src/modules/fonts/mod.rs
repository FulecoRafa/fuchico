use font_kit::source::SystemSource;

#[tauri::command]
pub fn fonts_list_system() -> Result<Vec<String>, String> {
    let mut families = SystemSource::new()
        .all_families()
        .map_err(|e| e.to_string())?;
    families.sort();
    families.dedup();
    Ok(families)
}
