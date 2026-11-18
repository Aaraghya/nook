/**
 * Shared domain types for Pocket.
 *
 * Each module's types live here so the frontend, Rust commands and future
 * services agree on one shape. Types marked "M3"/"M4"/"M5" correspond to the
 * milestone that first consumes them; they are defined up front so module
 * wiring later does not require type churn across the codebase.
 */

/** Which section of the panel is currently open. */
export type TabId = "clipboard" | "notes" | "snippets";

/* ------------------------------------------------------------------ */
/* Music — "Now Playing" (consumed from Milestone 3 onward)            */
/* ------------------------------------------------------------------ */

export interface TrackMetadata {
  /** Song title, e.g. "Midnight City". */
  title: string;
  /** Primary artist, e.g. "M83". */
  artist: string;
  /** Album name, when the media session provides it. */
  album?: string;
  /** Album artwork as a data URL or asset URL, when available. */
  artworkUrl?: string;
  /** Total track duration in seconds, when available. */
  durationSeconds?: number;
}

export interface PlaybackState {
  track: TrackMetadata | null;
  isPlaying: boolean;
  /** Elapsed playback position in seconds, when available. */
  positionSeconds?: number;
}

/* ------------------------------------------------------------------ */
/* Clipboard — "ClipStack" (consumed from Milestone 4 onward)          */
/* ------------------------------------------------------------------ */

export interface ClipboardEntry {
  id: string;
  content: string;
  /** ISO 8601 timestamp of when the entry was captured. */
  capturedAt: string;
  pinned: boolean;
}

/* ------------------------------------------------------------------ */
/* Notes — "Pinboard" (consumed from Milestone 5 onward)               */
/* ------------------------------------------------------------------ */

export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Snippets (consumed from Milestone 5 onward)                         */
/* ------------------------------------------------------------------ */

export interface Snippet {
  id: string;
  label: string;
  content: string;
  /** Free-form category tag, e.g. "email", "code", "url". */
  category: string;
  createdAt: string;
  updatedAt: string;
}
