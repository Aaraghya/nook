import { CalendarDays, Clock, ExternalLink, MapPin, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { parseEventText } from "../../services/calendar";
import { useCalendarStore } from "../../stores/calendar";

const DAY_MS = 86_400_000;

function formatDayLabel(date: Date): string {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startDay.getTime() - startToday.getTime()) / DAY_MS);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTimeRange(start: Date, end: Date): string {
  const time = (date: Date) =>
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${time(start)} – ${time(end)}`;
}

export function CalendarPanel() {
  const input = useCalendarStore((s) => s.input);
  const phase = useCalendarStore((s) => s.phase);
  const parsed = useCalendarStore((s) => s.parsed);
  const error = useCalendarStore((s) => s.error);
  const setInput = useCalendarStore((s) => s.setInput);
  const preview = useCalendarStore((s) => s.preview);
  const backToEdit = useCalendarStore((s) => s.backToEdit);
  const openInBrowser = useCalendarStore((s) => s.openInBrowser);

  const cardRef = useRef<HTMLDivElement>(null);

  const liveParse = useMemo(
    () => (input.trim() === "" ? null : parseEventText(input)),
    [input],
  );

  useEffect(() => {
    if (phase === "preview") cardRef.current?.focus();
  }, [phase]);

  if (phase === "preview" && parsed !== null) {
    return (
      <div
        ref={cardRef}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void openInBrowser();
          } else if ((event.key === "Enter" && event.shiftKey) || event.key === "Escape") {
            event.preventDefault();
            backToEdit();
          }
        }}
        className="flex h-full min-h-0 flex-col gap-3 outline-none"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">Calendar</h2>
          <span className="text-[10px] uppercase tracking-wide text-ink-muted">
            Preview
          </span>
        </header>
        <article className="rounded-card border border-hairline-strong bg-elevated p-3">
          <h3 className="text-[13px] font-medium text-ink">{parsed.title}</h3>
          <dl className="mt-2.5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-ink-secondary">
              <CalendarDays size={13} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
              <dd>{formatDayLabel(parsed.start)}</dd>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-secondary">
              <Clock size={13} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
              <dd>{formatTimeRange(parsed.start, parsed.end)}</dd>
            </div>
            {parsed.location !== null && (
              <div className="flex items-center gap-2 text-xs text-ink-secondary">
                <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
                <dd className="break-words">{parsed.location}</dd>
              </div>
            )}
          </dl>
        </article>
        {error !== null && (
          <p className="text-xs text-danger">{error}</p>
        )}
        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openInBrowser()}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-hairline-strong bg-raised px-3.5 py-1.5 text-xs font-medium text-ink transition-colors duration-150 ease-out-quart outline-none hover:border-hairline focus-visible:ring-1 focus-visible:ring-hairline-strong"
          >
            <ExternalLink size={13} strokeWidth={1.75} />
            Open in Google Calendar
          </button>
          <button
            type="button"
            onClick={backToEdit}
            aria-label="Edit event"
            title="Edit (Esc)"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control border border-hairline bg-elevated text-ink-secondary transition-colors duration-150 ease-out-quart outline-none hover:bg-raised hover:text-ink focus-visible:ring-1 focus-visible:ring-hairline-strong"
          >
            <Pencil size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold">Calendar</h2>
        <span className="text-[10px] uppercase tracking-wide text-ink-muted">
          Google Calendar
        </span>
      </header>
      <textarea
        value={input}
        placeholder="Try “lunch with mom tomorrow at 2pm at the diner”"
        autoFocus
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            preview();
          } else if (event.key === "Escape") {
            setInput("");
          }
        }}
        className="min-h-[84px] resize-none rounded-card border border-hairline bg-elevated p-3 text-xs leading-relaxed text-ink outline-none placeholder:text-ink-muted focus:border-hairline-strong"
      />
      {liveParse !== null && (
        <p className="text-[11px] leading-relaxed text-ink-muted">
          {formatDayLabel(liveParse.start)} · {formatTimeRange(liveParse.start, liveParse.end)}
          {liveParse.location !== null ? ` · ${liveParse.location}` : ""}
        </p>
      )}
      <p className="mt-auto text-[10px] leading-relaxed text-ink-muted">
        Type a sentence, then press Enter to preview.
        <br />
        No date means tomorrow · no time means 9 AM · Shift+Enter for a new line
      </p>
    </div>
  );
}
