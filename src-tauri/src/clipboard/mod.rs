use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, GetClipboardSequenceNumber,
    IsClipboardFormatAvailable, OpenClipboard, SetClipboardData,
};
use windows::Win32::System::Memory::{
    GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE,
};

const CLIPBOARD_EVENT: &str = "clipboard:new";
const CF_UNICODETEXT: u32 = 13;
const HISTORY_CAP: usize = 100;
const MAX_ENTRY_CHARS: usize = 100_000;
const POLL_INTERVAL_MS: u64 = 500;
const OPEN_ATTEMPTS: u32 = 3;
const OPEN_RETRY_DELAY_MS: u64 = 50;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardEntry {
    pub id: String,
    pub content: String,
    pub captured_at_ms: u64,
    pub pinned: bool,
}

pub struct ClipboardState {
    pub(crate) history: Mutex<Vec<ClipboardEntry>>,
    pub(crate) last_sequence: Mutex<u32>,
    pub(crate) next_id: AtomicU64,
    pub(crate) suppressed_content: Mutex<Option<String>>,
}

pub fn init(app: &AppHandle) {
    app.manage(ClipboardState {
        history: Mutex::new(Vec::new()),
        last_sequence: Mutex::new(0),
        next_id: AtomicU64::new(1),
        suppressed_content: Mutex::new(None),
    });
    let handle = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
        let sequence = unsafe { GetClipboardSequenceNumber() };
        let state = handle.state::<ClipboardState>();
        let mut stored = state.last_sequence.lock().unwrap();
        if sequence == 0 || sequence == *stored {
            continue;
        }
        *stored = sequence;
        drop(stored);
        drop(state);
        capture_clipboard_text(&handle);
    });
}

fn capture_clipboard_text(app: &AppHandle) {
    let Some(text) = read_clipboard_text() else {
        return;
    };
    if text.trim().is_empty() || text.chars().count() > MAX_ENTRY_CHARS {
        return;
    }
    let state = app.state::<ClipboardState>();
    {
        let mut suppressed = state.suppressed_content.lock().unwrap();
        if suppressed.as_deref() == Some(text.as_str()) {
            *suppressed = None;
            return;
        }
        *suppressed = None;
    }
    let mut history = state.history.lock().unwrap();
    if history.first().is_some_and(|entry| entry.content == text) {
        return;
    }
    if history
        .iter()
        .any(|entry| entry.pinned && entry.content == text)
    {
        return;
    }
    if let Some(index) = history.iter().position(|entry| entry.content == text) {
        history.remove(index);
    }
    let entry = ClipboardEntry {
        id: state.next_id.fetch_add(1, Ordering::Relaxed).to_string(),
        content: text,
        captured_at_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_millis() as u64)
            .unwrap_or(0),
        pinned: false,
    };
    history.insert(0, entry.clone());
    while history.len() > HISTORY_CAP {
        match history.iter().rposition(|entry| !entry.pinned) {
            Some(index) if index > 0 => {
                history.remove(index);
            }
            _ => break,
        }
    }
    drop(history);
    let _ = app.emit(CLIPBOARD_EVENT, &entry);
}

pub(crate) fn write_clipboard_text(text: &str) -> Result<(), String> {
    unsafe { OpenClipboard(None) }.map_err(|error| error.to_string())?;
    let result = write_open_clipboard(text);
    let close_result = unsafe { CloseClipboard() };
    result.and(close_result.map_err(|error| error.to_string()))
}

fn write_open_clipboard(text: &str) -> Result<(), String> {
    unsafe { EmptyClipboard() }.map_err(|error| error.to_string())?;
    let mut units: Vec<u16> = text.encode_utf16().collect();
    units.push(0);
    let byte_len = units.len() * 2;
    let handle = unsafe { GlobalAlloc(GMEM_MOVEABLE, byte_len) }
        .map_err(|error| error.to_string())?;
    let pointer = unsafe { GlobalLock(handle) };
    if pointer.is_null() {
        let _ = unsafe { GlobalFree(Some(handle)) };
        return Err("clipboard memory lock failed".to_string());
    }
    unsafe {
        core::ptr::copy_nonoverlapping(
            units.as_ptr().cast::<u8>(),
            pointer.cast::<u8>(),
            byte_len,
        );
    }
    let _ = unsafe { GlobalUnlock(handle) };
    match unsafe { SetClipboardData(CF_UNICODETEXT, Some(HANDLE(handle.0))) } {
        Ok(_) => Ok(()),
        Err(error) => {
            let _ = unsafe { GlobalFree(Some(handle)) };
            Err(error.to_string())
        }
    }
}

fn read_clipboard_text() -> Option<String> {
    for _ in 0..OPEN_ATTEMPTS {
        if unsafe { OpenClipboard(None) }.is_ok() {
            let text = read_open_clipboard();
            let _ = unsafe { CloseClipboard() };
            return text;
        }
        thread::sleep(Duration::from_millis(OPEN_RETRY_DELAY_MS));
    }
    None
}

fn read_open_clipboard() -> Option<String> {
    if unsafe { IsClipboardFormatAvailable(CF_UNICODETEXT) }.is_err() {
        return None;
    }
    let handle = unsafe { GetClipboardData(CF_UNICODETEXT) }.ok()?;
    let global = HGLOBAL(handle.0);
    let pointer = unsafe { GlobalLock(global) };
    if pointer.is_null() {
        return None;
    }
    let byte_count = unsafe { GlobalSize(global) };
    let units = unsafe {
        core::slice::from_raw_parts(pointer as *const u16, byte_count / 2)
    };
    let length = units
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(units.len());
    let text = String::from_utf16_lossy(&units[..length]);
    let _ = unsafe { GlobalUnlock(global) };
    Some(text)
}
