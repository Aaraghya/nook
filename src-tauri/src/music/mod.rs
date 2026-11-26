mod types;

use std::sync::Mutex;
use std::thread;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use tauri::{AppHandle, Emitter, Manager};
use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    CurrentSessionChangedEventArgs, GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionMediaProperties,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus, MediaPropertiesChangedEventArgs,
    PlaybackInfoChangedEventArgs, SessionsChangedEventArgs, TimelinePropertiesChangedEventArgs,
};
use windows::Storage::Streams::DataReader;

pub use types::{PlaybackSnapshot, ProgressUpdate, TrackMetadata, TrackUpdate};

const TRACK_EVENT: &str = "music:track";
const PROGRESS_EVENT: &str = "music:progress";

pub struct MusicState {
    pub(crate) session: Mutex<Option<GlobalSystemMediaTransportControlsSession>>,
    pub(crate) session_key: Mutex<Option<String>>,
    pub(crate) track: Mutex<Option<TrackMetadata>>,
    pub(crate) is_playing: Mutex<bool>,
    pub(crate) position_seconds: Mutex<Option<f64>>,
    pub(crate) duration_seconds: Mutex<Option<f64>>,
}

pub fn init(app: &AppHandle) {
    app.manage(MusicState {
        session: Mutex::new(None),
        session_key: Mutex::new(None),
        track: Mutex::new(None),
        is_playing: Mutex::new(false),
        position_seconds: Mutex::new(None),
        duration_seconds: Mutex::new(None),
    });
    let handle = app.clone();
    thread::spawn(move || start(&handle));
}

fn start(app: &AppHandle) {
    let manager = match GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .and_then(|operation| operation.join())
    {
        Ok(manager) => manager,
        Err(error) => {
            eprintln!("media session manager unavailable: {error}");
            return;
        }
    };

    let current_handler = TypedEventHandler::<
        GlobalSystemMediaTransportControlsSessionManager,
        CurrentSessionChangedEventArgs,
    >::new({
        let app = app.clone();
        move |sender, _| {
            if let Ok(manager) = sender.ok() {
                spawn_current(app.clone(), manager.GetCurrentSession().ok());
            }
            Ok(())
        }
    });
    if let Err(error) = manager.CurrentSessionChanged(&current_handler) {
        eprintln!("current session watch failed: {error}");
    }

    let sessions_handler = TypedEventHandler::<
        GlobalSystemMediaTransportControlsSessionManager,
        SessionsChangedEventArgs,
    >::new({
        let app = app.clone();
        move |sender, _| {
            if let Ok(manager) = sender.ok() {
                spawn_current(app.clone(), manager.GetCurrentSession().ok());
            }
            Ok(())
        }
    });
    if let Err(error) = manager.SessionsChanged(&sessions_handler) {
        eprintln!("sessions watch failed: {error}");
    }

    spawn_current(app.clone(), manager.GetCurrentSession().ok());

    let poll_app = app.clone();
    thread::spawn(move || loop {
        thread::sleep(std::time::Duration::from_secs(2));
        let next = manager.GetCurrentSession().ok();
        spawn_current(poll_app.clone(), next.clone());
        if let Some(session) = next {
            refresh_track(&poll_app, &session);
            refresh_progress(&poll_app, &session);
        }
    });
}

fn watch_session(app: &AppHandle, session: &GlobalSystemMediaTransportControlsSession) {
    let media_handler = TypedEventHandler::<
        GlobalSystemMediaTransportControlsSession,
        MediaPropertiesChangedEventArgs,
    >::new({
        let app = app.clone();
        move |sender, _| {
            if let Ok(current) = sender.ok() {
                spawn_track_check(app.clone(), current.clone());
            }
            Ok(())
        }
    });
    let _ = session.MediaPropertiesChanged(&media_handler);

    let playback_handler = TypedEventHandler::<
        GlobalSystemMediaTransportControlsSession,
        PlaybackInfoChangedEventArgs,
    >::new({
        let app = app.clone();
        move |sender, _| {
            if let Ok(current) = sender.ok() {
                spawn_progress_check(app.clone(), current.clone());
            }
            Ok(())
        }
    });
    let _ = session.PlaybackInfoChanged(&playback_handler);

    let timeline_handler = TypedEventHandler::<
        GlobalSystemMediaTransportControlsSession,
        TimelinePropertiesChangedEventArgs,
    >::new({
        let app = app.clone();
        move |sender, _| {
            if let Ok(current) = sender.ok() {
                spawn_progress_check(app.clone(), current.clone());
            }
            Ok(())
        }
    });
    let _ = session.TimelinePropertiesChanged(&timeline_handler);
}

fn spawn_track_check(app: AppHandle, session: GlobalSystemMediaTransportControlsSession) {
    thread::spawn(move || {
        if is_current(&app, &session) {
            refresh_track(&app, &session);
        }
    });
}

fn spawn_progress_check(app: AppHandle, session: GlobalSystemMediaTransportControlsSession) {
    thread::spawn(move || {
        if is_current(&app, &session) {
            refresh_progress(&app, &session);
        }
    });
}

fn spawn_current(app: AppHandle, next: Option<GlobalSystemMediaTransportControlsSession>) {
    thread::spawn(move || {
        let next = match next {
            Some(session) if session.GetPlaybackInfo().is_ok() => Some(session),
            _ => None,
        };
        let next_key = next
            .as_ref()
            .and_then(|session| session.SourceAppUserModelId().ok())
            .map(|value| value.to_string());

        let state = app.state::<MusicState>();
        let stored_key = state.session_key.lock().unwrap().clone();
        if stored_key == next_key {
            let alive = state
                .session
                .lock()
                .unwrap()
                .as_ref()
                .map(|session| session.GetPlaybackInfo().is_ok())
                .unwrap_or(false);
            if alive || next.is_none() {
                return;
            }
        }

        *state.session.lock().unwrap() = next.clone();
        *state.session_key.lock().unwrap() = next_key;
        drop(state);

        match next {
            Some(session) => {
                watch_session(&app, &session);
                refresh_track(&app, &session);
            }
            None => clear_track(&app),
        }
    });
}

fn is_current(app: &AppHandle, session: &GlobalSystemMediaTransportControlsSession) -> bool {
    let key = session
        .SourceAppUserModelId()
        .ok()
        .map(|value| value.to_string());
    key.is_some() && key == *app.state::<MusicState>().session_key.lock().unwrap()
}

fn refresh_track(app: &AppHandle, session: &GlobalSystemMediaTransportControlsSession) {
    let properties = match session.TryGetMediaPropertiesAsync().and_then(|o| o.join()) {
        Ok(properties) => properties,
        Err(error) => {
            eprintln!("media properties failed: {error}");
            return;
        }
    };

    let title = properties
        .Title()
        .map(|v| v.to_string())
        .unwrap_or_default();
    let artist = properties
        .Artist()
        .map(|v| v.to_string())
        .unwrap_or_default();
    let album = properties
        .AlbumTitle()
        .map(|v| v.to_string())
        .ok()
        .filter(|v| !v.is_empty());

    let state = app.state::<MusicState>();
    let unchanged = {
        let track = state.track.lock().unwrap();
        track
            .as_ref()
            .is_some_and(|t| t.title == title && t.artist == artist && t.album == album)
    };
    if unchanged {
        drop(state);
        refresh_progress(app, session);
        return;
    }

    let artwork = fetch_artwork(&properties);
    let duration = session
        .GetTimelineProperties()
        .ok()
        .and_then(|timeline| timeline.EndTime().ok())
        .map(|span| span.Duration as f64 / 10_000_000.0)
        .filter(|value| *value > 0.0);

    *state.track.lock().unwrap() = Some(TrackMetadata {
        title,
        artist,
        album,
        artwork_url: artwork,
        duration_seconds: duration,
    });
    drop(state);
    emit_track(app);
    refresh_progress(app, session);
}

fn refresh_progress(app: &AppHandle, session: &GlobalSystemMediaTransportControlsSession) {
    let timeline = session.GetTimelineProperties().ok();
    let position = timeline
        .as_ref()
        .and_then(|t| t.Position().ok())
        .map(|span| span.Duration as f64 / 10_000_000.0);
    let duration = timeline
        .as_ref()
        .and_then(|t| t.EndTime().ok())
        .map(|span| span.Duration as f64 / 10_000_000.0)
        .filter(|value| *value > 0.0);
    let is_playing = session
        .GetPlaybackInfo()
        .ok()
        .and_then(|info| info.PlaybackStatus().ok())
        .is_some_and(|status| {
            status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
        });

    let state = app.state::<MusicState>();
    let changed = {
        let mut position_guard = state.position_seconds.lock().unwrap();
        let mut duration_guard = state.duration_seconds.lock().unwrap();
        let mut playing_guard = state.is_playing.lock().unwrap();

        let mut changed = false;
        if position.is_some() && *position_guard != position {
            *position_guard = position;
            changed = true;
        }
        if *duration_guard != duration {
            *duration_guard = duration;
            changed = true;
        }
        if *playing_guard != is_playing {
            *playing_guard = is_playing;
            changed = true;
        }
        changed
    };
    if changed {
        emit_progress(app);
    }
}

fn clear_track(app: &AppHandle) {
    let state = app.state::<MusicState>();
    *state.track.lock().unwrap() = None;
    *state.is_playing.lock().unwrap() = false;
    *state.position_seconds.lock().unwrap() = None;
    *state.duration_seconds.lock().unwrap() = None;
    emit_track(app);
    emit_progress(app);
}

fn emit_track(app: &AppHandle) {
    let state = app.state::<MusicState>();
    let payload = TrackUpdate {
        track: state.track.lock().unwrap().clone(),
        is_playing: *state.is_playing.lock().unwrap(),
    };
    let _ = app.emit(TRACK_EVENT, payload);
}

fn emit_progress(app: &AppHandle) {
    let state = app.state::<MusicState>();
    let payload = ProgressUpdate {
        position_seconds: *state.position_seconds.lock().unwrap(),
        duration_seconds: *state.duration_seconds.lock().unwrap(),
        is_playing: *state.is_playing.lock().unwrap(),
    };
    let _ = app.emit(PROGRESS_EVENT, payload);
}

fn fetch_artwork(
    properties: &GlobalSystemMediaTransportControlsSessionMediaProperties,
) -> Option<String> {
    let reference = properties.Thumbnail().ok()?;
    let stream = reference.OpenReadAsync().ok()?.join().ok()?;
    let content_type = stream.ContentType().ok()?.to_string();
    let size = stream.Size().ok()? as u32;
    if size == 0 {
        return None;
    }
    let input = stream.GetInputStreamAt(0).ok()?;
    let reader = DataReader::CreateDataReader(&input).ok()?;
    let loaded = reader.LoadAsync(size).ok()?.join().ok()? as usize;
    let mut bytes = vec![0u8; loaded];
    reader.ReadBytes(&mut bytes).ok()?;
    Some(format!(
        "data:{content_type};base64,{}",
        STANDARD.encode(bytes)
    ))
}
