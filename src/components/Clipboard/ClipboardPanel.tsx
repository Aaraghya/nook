import { Check, ClipboardList, Copy, Pin, PinOff, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  copyClipboardEntry,
  deleteClipboardEntry,
  fetchClipboardEntries,
  subscribeClipboardNew,
  toggleClipboardEntryPin,
} from "../../services/clipboard";
import { useClipboardStore } from "../../stores/clipboard";
import { EmptyState } from "../common/EmptyState";
import { IconButton } from "../common/IconButton";

const COPY_FEEDBACK_MS = 1200;

export function ClipboardPanel() {
  const entries = useClipboardStore((s) => s.entries);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const feedbackTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    fetchClipboardEntries().then((entries) => {
      if (!cancelled) useClipboardStore.getState().applyEntries(entries);
    });

    subscribeClipboardNew((entry) =>
      useClipboardStore.getState().applyNewEntry(entry),
    ).then((unlisten) => {
      if (cancelled) unlisten();
      else unsubs.push(unlisten);
    });

    return () => {
      cancelled = true;
      unsubs.forEach((unlisten) => unlisten());
      if (feedbackTimer.current !== null) {
        window.clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const handleCopy = (id: string) => {
    copyClipboardEntry(id)
      .then(() => {
        setCopiedId(id);
        if (feedbackTimer.current !== null) {
          window.clearTimeout(feedbackTimer.current);
        }
        feedbackTimer.current = window.setTimeout(
          () => setCopiedId(null),
          COPY_FEEDBACK_MS,
        );
      })
      .catch(() => undefined);
  };

  const handleTogglePin = (id: string) => {
    toggleClipboardEntryPin(id)
      .then(() => useClipboardStore.getState().togglePin(id))
      .catch(() => undefined);
  };

  const handleDelete = (id: string) => {
    deleteClipboardEntry(id)
      .then(() => useClipboardStore.getState().deleteEntry(id))
      .catch(() => undefined);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold">Clipboard</h2>
        <span className="text-[11px] text-ink-muted">ClipStack</span>
      </header>
      {entries.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No clips yet"
          hint="Copy anything and it will land here, ready to paste again."
        />
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="group rounded-control border border-hairline bg-elevated/60 p-3 transition-colors duration-150 ease-out-quart hover:border-hairline-strong"
            >
              <p className="line-clamp-4 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-secondary">
                {entry.content}
              </p>
              <footer className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {entry.pinned && (
                    <Pin
                      size={11}
                      strokeWidth={1.75}
                      className="fill-current text-ink-muted"
                    />
                  )}
                  <time
                    dateTime={entry.capturedAt}
                    className="text-[10px] tabular-nums text-ink-muted"
                  >
                    {formatTimestamp(entry.capturedAt)}
                  </time>
                </div>
                <div
                  className={`flex items-center gap-0.5 transition-opacity duration-150 ease-out-quart ${
                    copiedId === entry.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                  }`}
                >
                  <IconButton
                    label="Copy clip"
                    size="sm"
                    onClick={() => handleCopy(entry.id)}
                  >
                    {copiedId === entry.id ? (
                      <Check size={13} strokeWidth={2} />
                    ) : (
                      <Copy size={13} strokeWidth={1.75} />
                    )}
                  </IconButton>
                  <IconButton
                    label={entry.pinned ? "Unpin clip" : "Pin clip"}
                    size="sm"
                    onClick={() => handleTogglePin(entry.id)}
                  >
                    {entry.pinned ? (
                      <PinOff size={13} strokeWidth={1.75} />
                    ) : (
                      <Pin size={13} strokeWidth={1.75} />
                    )}
                  </IconButton>
                  <IconButton
                    label="Delete clip"
                    size="sm"
                    onClick={() => handleDelete(entry.id)}
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </IconButton>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(capturedAt: string): string {
  const date = new Date(capturedAt);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
