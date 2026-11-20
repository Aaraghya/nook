import { create } from "zustand";
import type { PlaybackState, TrackMetadata } from "../types";
import type { ProgressEvent, TrackEvent } from "../services/music";

interface MusicStore {
  track: TrackMetadata | null;
  isPlaying: boolean;
  positionSeconds: number | null;
  durationSeconds: number | null;
  positionUpdatedAt: number | null;
  applyPlaybackState: (state: PlaybackState) => void;
  applyTrackEvent: (event: TrackEvent) => void;
  applyProgressEvent: (event: ProgressEvent) => void;
}

export const useMusicStore = create<MusicStore>((set) => ({
  track: null,
  isPlaying: false,
  positionSeconds: null,
  durationSeconds: null,
  positionUpdatedAt: null,
  applyPlaybackState: (state) =>
    set({
      track: state.track,
      isPlaying: state.isPlaying,
      positionSeconds: state.positionSeconds ?? null,
      durationSeconds: state.track?.durationSeconds ?? null,
      positionUpdatedAt: Date.now(),
    }),
  applyTrackEvent: (event) =>
    set({
      track: event.track,
      isPlaying: event.isPlaying,
      ...(event.track
        ? { positionSeconds: 0, positionUpdatedAt: Date.now() }
        : { positionSeconds: null, positionUpdatedAt: null }),
      durationSeconds: event.track?.durationSeconds ?? null,
    }),
  applyProgressEvent: (event) =>
    set({
      isPlaying: event.isPlaying,
      ...(event.positionSeconds !== undefined
        ? { positionSeconds: event.positionSeconds, positionUpdatedAt: Date.now() }
        : {}),
      ...(event.durationSeconds !== undefined
        ? { durationSeconds: event.durationSeconds }
        : {}),
    }),
}));
