//! Clipboard monitoring + history — "ClipStack".
//!
//! Milestone 4: receive Windows clipboard update notifications (no tight
//! polling), capture text entries, de-duplicate, persist history in
//! SQLite, and expose search/pin/copy/delete commands. Privacy controls
//! (per-app exclusion) live here too.
