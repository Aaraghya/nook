import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PlaybackState, TrackMetadata } from "../types";

export interface TrackEvent {
  track: TrackMetadata | null;
  isPlaying: boolean;
}

export interface ProgressEvent {
  positionSeconds?: number;
  durationSeconds?: number;
  isPlaying: boolean;
}

export function fetchPlaybackState(): Promise<PlaybackState> {
  return invoke<PlaybackState>("music_get_state");
}

export function subscribeTrack(
  handler: (event: TrackEvent) => void,
): Promise<UnlistenFn> {
  return listen<TrackEvent>("music:track", (event) => handler(event.payload));
}

export function subscribeProgress(
  handler: (event: ProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<ProgressEvent>("music:progress", (event) =>
    handler(event.payload),
  );
}

export function playPause(): Promise<void> {
  return invoke("music_play_pause");
}

export function nextTrack(): Promise<void> {
  return invoke("music_next");
}

export function previousTrack(): Promise<void> {
  return invoke("music_previous");
}
