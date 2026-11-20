use tauri::{AppHandle, Manager};
use windows::Media::Control::GlobalSystemMediaTransportControlsSession;

use crate::music::{MusicState, PlaybackSnapshot};

fn current_session(app: &AppHandle) -> Option<GlobalSystemMediaTransportControlsSession> {
    app.state::<MusicState>().session.lock().unwrap().clone()
}

#[tauri::command]
pub fn music_get_state(app: AppHandle) -> PlaybackSnapshot {
    let state = app.state::<MusicState>();
    let track = state.track.lock().unwrap().clone();
    let is_playing = *state.is_playing.lock().unwrap();
    let position_seconds = *state.position_seconds.lock().unwrap();
    PlaybackSnapshot {
        track,
        is_playing,
        position_seconds,
    }
}

#[tauri::command]
pub async fn music_play_pause(app: AppHandle) {
    if let Some(session) = current_session(&app) {
        tauri::async_runtime::spawn_blocking(move || {
            if let Err(error) = session
                .TryTogglePlayPauseAsync()
                .and_then(|operation| operation.join())
            {
                eprintln!("play/pause failed: {error}");
            }
        });
    }
}

#[tauri::command]
pub async fn music_next(app: AppHandle) {
    if let Some(session) = current_session(&app) {
        tauri::async_runtime::spawn_blocking(move || {
            if let Err(error) = session
                .TrySkipNextAsync()
                .and_then(|operation| operation.join())
            {
                eprintln!("next track failed: {error}");
            }
        });
    }
}

#[tauri::command]
pub async fn music_previous(app: AppHandle) {
    if let Some(session) = current_session(&app) {
        tauri::async_runtime::spawn_blocking(move || {
            if let Err(error) = session
                .TrySkipPreviousAsync()
                .and_then(|operation| operation.join())
            {
                eprintln!("previous track failed: {error}");
            }
        });
    }
}
