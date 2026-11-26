import {
  AlertCircle,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCalendarStore, type CalendarEntry } from "../../stores/calendar";

const DAY_MS = 86_400_000;
const DELETE_ARM_MS = 3000;

function formatDayLabel(date: Date): string {
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startDay.getTime() - startToday.getTime()) / DAY_MS,
  );
  const formatted = date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (diffDays === 0) return `Today · ${formatted}`;
  if (diffDays === 1) return `Tomorrow · ${formatted}`;
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeRange(start: Date, end: Date): string {
  const time = (date: Date) =>
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${time(start)} – ${time(end)}`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return target.isContentEditable;
}

export function CalendarPanel() {
  const entries = useCalendarStore((s) => s.entries);
  const activeId = useCalendarStore((s) => s.activeId);
  const focusNonce = useCalendarStore((s) => s.focusNonce);
  const entryLimitError = useCalendarStore((s) => s.entryLimitError);
  const loadEntries = useCalendarStore((s) => s.loadEntries);
  const addEntry = useCalendarStore((s) => s.addEntry);
  const selectEntry = useCalendarStore((s) => s.selectEntry);
  const collapseEntry = useCalendarStore((s) => s.collapseEntry);
  const setInput = useCalendarStore((s) => s.setInput);
  const previewEntry = useCalendarStore((s) => s.previewEntry);
  const backToEdit = useCalendarStore((s) => s.backToEdit);
  const deleteEntry = useCalendarStore((s) => s.deleteEntry);
  const openInBrowser = useCalendarStore((s) => s.openInBrowser);

  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const armTimerRef = useRef<number | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const previewCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeSectionRef = useRef<HTMLElement | null>(null);

  const activeEntry = entries.find((entry) => entry.id === activeId);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    return () => {
      if (armTimerRef.current !== null) {
        window.clearTimeout(armTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeEntry) return;
    if (activeEntry.phase === "edit") {
      textareaRefs.current[activeEntry.id]?.focus();
    } else {
      previewCardRefs.current[activeEntry.id]?.focus();
    }
  }, [activeId, activeEntry?.phase, focusNonce]);

  useEffect(() => {
    if (activeEntry?.phase !== "preview") return;
    const handlePointerDown = (event: PointerEvent) => {
      if (activeSectionRef.current?.contains(event.target as Node)) return;
      collapseEntry();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activeEntry?.id, activeEntry?.phase, collapseEntry]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (!event.shiftKey) return;
      const isPlusCombo =
        event.key === "+" ||
        event.code === "Equal" ||
        event.code === "NumpadAdd";
      if (!isPlusCombo) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      addEntry();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addEntry]);

  const disarmDelete = () => {
    setArmedDeleteId(null);
    if (armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  };

  const handleDeleteClick = (entry: CalendarEntry) => {
    if (entry.input.trim() === "") {
      disarmDelete();
      deleteEntry(entry.id);
      return;
    }
    if (armedDeleteId === entry.id) {
      disarmDelete();
      deleteEntry(entry.id);
      return;
    }
    setArmedDeleteId(entry.id);
    if (armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
    }
    armTimerRef.current = window.setTimeout(() => {
      setArmedDeleteId(null);
      armTimerRef.current = null;
    }, DELETE_ARM_MS);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold">Calendar</h2>
          <span className="text-[10px] uppercase tracking-wide text-ink-muted">
            Google Calendar
          </span>
        </div>
        <div className="flex items-center gap-2">
          {entryLimitError !== null && (
            <span className="text-[10px] text-danger">10 entries max</span>
          )}
          <button
            type="button"
            onClick={() => addEntry()}
            aria-label="Add calendar entry"
            title="Add calendar entry (Shift + +)"
            className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-hairline bg-elevated px-2 text-[11px] font-medium text-ink-secondary transition-colors duration-150 ease-out-quart outline-none hover:border-hairline-strong hover:bg-raised hover:text-ink focus-visible:ring-1 focus-visible:ring-hairline-strong"
          >
            <Plus size={12} strokeWidth={2} className="text-amber-400" />
            <span className="text-[10px] text-ink-muted">Shift++</span>
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {entries.map((entry, index) => {
          const isActive = entry.id === activeEntry?.id;
          const label = `Entry ${index + 1}`;
          const isArmed = armedDeleteId === entry.id;

          if (!isActive) {
            return (
              <article
                key={entry.id}
                onClick={() => selectEntry(entry.id)}
                className="group flex cursor-pointer items-center justify-between gap-2 rounded-control border border-hairline bg-elevated/60 px-3 py-2 transition-colors duration-150 ease-out-quart hover:border-hairline-strong hover:bg-elevated"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-ink">
                      {label}
                    </span>
                    {entry.phase === "preview" && entry.parseError === null && (
                      <span className="rounded-full border border-hairline bg-raised px-1.5 py-0.2 text-[9px] uppercase tracking-wide text-amber-400/90">
                        Preview
                      </span>
                    )}
                    {entry.parseError !== null && (
                      <span className="rounded-full border border-danger/30 bg-danger/10 px-1.5 py-0.2 text-[9px] uppercase tracking-wide text-danger">
                        Invalid
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                    {entry.parsed !== null
                      ? `${entry.parsed.title} · ${formatDayLabel(entry.parsed.start)}`
                      : entry.input.trim() !== ""
                        ? entry.input.trim()
                        : "Empty entry"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteClick(entry);
                  }}
                  aria-label={isArmed ? `Confirm delete ${label}` : `Delete ${label}`}
                  title={isArmed ? "Click again to delete" : `Delete ${label}`}
                  className={`inline-flex h-6 shrink-0 cursor-pointer items-center justify-center rounded-full border px-1.5 transition-colors duration-150 ease-out-quart outline-none focus-visible:ring-1 focus-visible:ring-hairline-strong ${
                    isArmed
                      ? "border-danger/40 bg-danger/15 text-danger"
                      : "border-transparent text-ink-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  {isArmed ? (
                    <span className="text-[10px] font-semibold">Sure?</span>
                  ) : (
                    <Trash2 size={12} strokeWidth={1.75} />
                  )}
                </button>
              </article>
            );
          }

          return (
            <section
              key={entry.id}
              aria-label={label}
              ref={isActive ? activeSectionRef : undefined}
              className="flex flex-col gap-2.5 rounded-card border border-hairline-strong bg-elevated p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-400" />
                  <span className="text-[11px] font-semibold text-ink">
                    {label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                    {entry.phase === "preview" ? "Preview" : "Draft"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(entry)}
                  aria-label={isArmed ? `Confirm delete ${label}` : `Delete ${label}`}
                  title={isArmed ? "Click again to delete" : `Delete ${label}`}
                  className={`inline-flex h-6 shrink-0 cursor-pointer items-center justify-center rounded-full border px-1.5 transition-colors duration-150 ease-out-quart outline-none focus-visible:ring-1 focus-visible:ring-hairline-strong ${
                    isArmed
                      ? "border-danger/40 bg-danger/15 text-danger"
                      : "border-transparent text-ink-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  {isArmed ? (
                    <span className="text-[10px] font-semibold">Sure?</span>
                  ) : (
                    <Trash2 size={12} strokeWidth={1.75} />
                  )}
                </button>
              </div>

              {entry.phase === "preview" ? (
                <div
                  ref={(node) => {
                    previewCardRefs.current[entry.id] = node;
                  }}
                  tabIndex={-1}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      entry.parsed !== null &&
                      entry.parseError === null
                    ) {
                      event.preventDefault();
                      void openInBrowser(entry.id);
                    } else if (
                      (event.key === "Enter" && event.shiftKey) ||
                      event.key === "Escape"
                    ) {
                      event.preventDefault();
                      if (isArmed) {
                        disarmDelete();
                      } else {
                        backToEdit(entry.id);
                      }
                    }
                  }}
                  className="flex flex-col gap-2.5 outline-none"
                >
                  {entry.parseError !== null || entry.parsed === null ? (
                    <div className="rounded-control border border-danger/35 bg-danger/10 p-2.5">
                      <div className="flex items-start gap-2 text-xs text-danger">
                        <AlertCircle
                          size={14}
                          strokeWidth={1.75}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {entry.parseError ?? "Could not parse event details."}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-ink-secondary">
                            {entry.input.trim()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-control border border-hairline bg-surface/60 p-2.5">
                      <h3 className="text-[13px] font-medium text-ink">
                        {entry.parsed.title}
                      </h3>
                      <dl className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-ink-secondary">
                          <CalendarDays
                            size={13}
                            strokeWidth={1.75}
                            className="shrink-0 text-amber-400/80"
                          />
                          <dd>{formatDayLabel(entry.parsed.start)}</dd>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-ink-secondary">
                          <Clock
                            size={13}
                            strokeWidth={1.75}
                            className="shrink-0 text-amber-400/80"
                          />
                          <dd>
                            {formatTimeRange(
                              entry.parsed.start,
                              entry.parsed.end,
                            )}
                          </dd>
                        </div>
                        {entry.parsed.location !== null && (
                          <div className="flex items-center gap-2 text-xs text-ink-secondary">
                            <MapPin
                              size={13}
                              strokeWidth={1.75}
                              className="shrink-0 text-amber-400/80"
                            />
                            <dd className="break-words">
                              {entry.parsed.location}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {entry.submitError !== null && (
                    <p className="text-xs text-danger">{entry.submitError}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={entry.parseError !== null || entry.parsed === null}
                      onClick={() => void openInBrowser(entry.id)}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-hairline-strong bg-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 ease-out-quart outline-none hover:border-amber-400/40 focus-visible:ring-1 focus-visible:ring-hairline-strong disabled:pointer-events-none disabled:opacity-45"
                    >
                      <ExternalLink size={13} strokeWidth={1.75} />
                      Open in Google Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => backToEdit(entry.id)}
                      aria-label={`Edit ${label}`}
                      title="Edit (Esc)"
                      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control border border-hairline bg-surface/60 text-ink-secondary transition-colors duration-150 ease-out-quart outline-none hover:bg-raised hover:text-ink focus-visible:ring-1 focus-visible:ring-hairline-strong"
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    ref={(node) => {
                      textareaRefs.current[entry.id] = node;
                    }}
                    value={entry.input}
                    placeholder="Try “lunch with mom tomorrow at 2pm at the diner”"
                    onChange={(event) => {
                      if (isArmed) disarmDelete();
                      setInput(entry.id, event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        previewEntry(entry.id);
                      } else if (event.key === "Escape") {
                        if (isArmed) {
                          disarmDelete();
                        } else {
                          setInput(entry.id, "");
                        }
                      }
                    }}
                    className="min-h-[68px] resize-none rounded-control border border-hairline bg-surface/60 p-2.5 text-xs leading-relaxed text-ink outline-none placeholder:text-ink-muted focus:border-hairline-strong"
                  />

                  {entry.input.trim() !== "" && (
                    <div className="flex items-center justify-between gap-2">
                      {entry.parseError !== null ? (
                        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-danger">
                          <AlertCircle size={12} className="shrink-0" />
                          <span className="truncate">{entry.parseError}</span>
                        </p>
                      ) : entry.parsed !== null ? (
                        <p className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
                          {entry.parsed.title} ·{" "}
                          {formatDayLabel(entry.parsed.start)} ·{" "}
                          {formatTimeRange(
                            entry.parsed.start,
                            entry.parsed.end,
                          )}
                          {entry.parsed.location !== null
                            ? ` · ${entry.parsed.location}`
                            : ""}
                        </p>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => previewEntry(entry.id)}
                        className="shrink-0 cursor-pointer rounded-control border border-hairline bg-raised px-2.5 py-1 text-[11px] font-medium text-ink transition-colors duration-150 ease-out-quart outline-none hover:border-hairline-strong focus-visible:ring-1 focus-visible:ring-hairline-strong"
                      >
                        Preview
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>

      <p className="shrink-0 text-[10px] leading-relaxed text-ink-muted">
        Enter to preview · Shift+Enter for new line · Shift++ adds an entry
      </p>
    </div>
  );
}
