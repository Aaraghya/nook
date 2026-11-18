import { Music2, Play, SkipBack, SkipForward } from "lucide-react";
import { Card } from "../common/Card";
import { IconButton } from "../common/IconButton";

/**
 * "Now Playing" hero card.
 *
 * Milestone 1 shows the dormant state only: the layout, artwork tile and
 * control row are real, but playback wiring (GSMTC media sessions,
 * artwork, progress) arrives in Milestone 3 and will fill this exact
 * structure rather than replace it.
 */
export function MusicCard() {
  return (
    <section aria-label="Now playing">
      <Card className="p-3.5">
        <div className="flex items-center gap-3.5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-control border border-hairline bg-raised text-ink-muted">
            <Music2 size={22} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-ink">
              Nothing playing
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              Media info appears when a player is running
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1">
          <IconButton label="Previous track" size="sm" disabled>
            <SkipBack size={15} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Play or pause" disabled>
            <Play size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Next track" size="sm" disabled>
            <SkipForward size={15} strokeWidth={1.75} />
          </IconButton>
        </div>
      </Card>
    </section>
  );
}
