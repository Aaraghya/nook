//! Tauri command handlers.
//!
//! Commands are thin: validate input, delegate to the owning feature module
//! (music, clipboard, notes, snippets), return serialisable results. One
//! file per feature area once Milestone 3+ begins; register them in
//! `lib.rs` via `tauri::Builder::invoke_handler`.

pub mod clipboard;
pub mod music;
