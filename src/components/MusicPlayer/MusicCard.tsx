import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchPlaybackState,
  nextTrack,
  playPause,
  previousTrack,
  subscribeProgress,
  subscribeTrack,
} from "../../services/music";
import { useMusicStore } from "../../stores/music";
import { Card } from "../common/Card";
import { IconButton } from "../common/IconButton";

export function MusicCard() {
  const track = useMusicStore((s) => s.track);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const positionSeconds = useMusicStore((s) => s.positionSeconds);
  const durationSeconds = useMusicStore((s) => s.durationSeconds);
  const positionUpdatedAt = useMusicStore((s) => s.positionUpdatedAt);
  const [, setTick] = useState(0);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const artworkUrl = track?.artworkUrl ?? null;

  useEffect(() => {
    setArtworkFailed(false);
  }, [artworkUrl]);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    fetchPlaybackState().then((state) => {
      if (!cancelled) useMusicStore.getState().applyPlaybackState(state);
    });

    subscribeTrack((event) => useMusicStore.getState().applyTrackEvent(event)).then(
      (unlisten) => {
        if (cancelled) unlisten();
        else unsubs.push(unlisten);
      },
    );
    subscribeProgress((event) =>
      useMusicStore.getState().applyProgressEvent(event),
    ).then((unlisten) => {
      if (cancelled) unlisten();
      else unsubs.push(unlisten);
    });

    const timer = window.setInterval(() => setTick((t) => t + 1), 500);

    return () => {
      cancelled = true;
      unsubs.forEach((unlisten) => unlisten());
      window.clearInterval(timer);
    };
  }, []);

  const hasTrack = track !== null;
  const elapsed =
    isPlaying && positionSeconds !== null && positionUpdatedAt !== null
      ? Math.min(
          positionSeconds + (Date.now() - positionUpdatedAt) / 1000,
          durationSeconds ?? positionSeconds,
        )
      : positionSeconds;

  return (
    <section aria-label="Now playing">
      <Card className="p-3.5">
        <div className="flex items-center gap-3.5">
          {hasTrack && artworkUrl && !artworkFailed ? (
            <img
              src={artworkUrl}
              alt=""
              className="size-14 shrink-0 rounded-control border border-hairline object-cover"
              onError={() => setArtworkFailed(true)}
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-control border border-hairline bg-raised text-ink-muted">
              <Music2 size={22} strokeWidth={1.5} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-ink">
              {hasTrack && track.title ? track.title : "Nothing playing"}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {hasTrack ? track.artist || "Unknown artist" : "Media info appears when a player is running"}
            </p>
          </div>
        </div>

        {hasTrack && (durationSeconds ?? 0) > 0 && elapsed !== null ? (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[10px] tabular-nums text-ink-muted">
              {formatTime(elapsed)}
            </span>
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-hairline">
              <div
                className="h-full rounded-full bg-ink-muted"
                style={{
                  width: `${Math.min(100, Math.max(0, (elapsed / (durationSeconds ?? 1)) * 100))}%`,
                }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-ink-muted">
              {formatTime(durationSeconds ?? 0)}
            </span>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-center gap-1">
          <IconButton
            label="Previous track"
            size="sm"
            disabled={!hasTrack}
            onClick={() => void previousTrack()}
          >
            <SkipBack size={15} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label="Play or pause"
            disabled={!hasTrack}
            onClick={() => void playPause()}
          >
            {isPlaying ? (
              <Pause size={16} strokeWidth={1.75} />
            ) : (
              <Play size={16} strokeWidth={1.75} />
            )}
          </IconButton>
          <IconButton
            label="Next track"
            size="sm"
            disabled={!hasTrack}
            onClick={() => void nextTrack()}
          >
            <SkipForward size={15} strokeWidth={1.75} />
          </IconButton>
        </div>
      </Card>
    </section>
  );
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
