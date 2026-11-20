//! Pocket application entry point.
//!
//! Modules mirror the product's feature boundaries. Each module is
//! deliberately empty until its milestone lands, so later integration is
//! additive — no architectural rewrites:
//!
//! - `commands`  — Tauri command handlers, one file per feature area
//! - `music`     — GSMTC media session integration (Milestone 3)
//! - `clipboard` — clipboard monitoring + history (Milestone 4)
//! - `notes`     — Pinboard CRUD over SQLite (Milestone 5)
//! - `snippets`  — pinned snippet storage (Milestone 5)
//! - `system`    — tray, single instance, global shortcuts (Milestone 2)
//! - `storage`   — SQLite pool management + migrations
//! - `state`     — shared application state containers

mod clipboard;
mod commands;
mod music;
mod notes;
mod snippets;
mod state;
mod storage;
mod system;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            system::show_main(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_window_event(system::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::music::music_get_state,
            commands::music::music_play_pause,
            commands::music::music_next,
            commands::music::music_previous,
            commands::clipboard::clipboard_get_entries,
            commands::clipboard::clipboard_copy,
            commands::clipboard::clipboard_toggle_pin,
            commands::clipboard::clipboard_delete,
        ])
        .setup(|app| {
            system::setup(app)?;
            music::init(app.handle());
            clipboard::init(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
