import { Check, Pin, PinOff, Plus, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createNote,
  deleteNote,
  fetchNotes,
  saveNote,
  toggleNotePin,
} from "../../services/notes";
import { useNotesStore } from "../../stores/notes";
import type { Note } from "../../types";
import { EmptyState } from "../common/EmptyState";
import { IconButton } from "../common/IconButton";
import { SearchInput } from "../common/SearchInput";

const AUTOSAVE_DELAY_MS = 600;
const SAVED_FEEDBACK_MS = 1400;

type SaveState = "idle" | "saving" | "saved";

export function NotesPanel() {
  const notes = useNotesStore((s) => s.notes);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const titleInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<number | null>(null);
  const savedTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const editing = useRef<{ id: string; title: string; body: string } | null>(
    null,
  );

  editing.current = editingId ? { id: editingId, ...draft } : null;

  useEffect(() => {
    let cancelled = false;
    fetchNotes().then((loaded) => {
      if (!cancelled) useNotesStore.getState().setNotes(loaded);
    });
    return () => {
      cancelled = true;
      flushPendingSave();
    };
  }, []);

  useEffect(() => {
    if (!editingId) return;
    if (draft.title === "" && draft.body === "") {
      titleInputRef.current?.focus();
    } else {
      bodyInputRef.current?.focus();
    }
  }, [editingId]);

  function persist(id: string, title: string, body: string) {
    setSaveState("saving");
    saveNote(id, title, body)
      .then((saved) => {
        useNotesStore.getState().upsert(saved);
        setSaveState("saved");
        if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
        savedTimer.current = window.setTimeout(
          () => setSaveState("idle"),
          SAVED_FEEDBACK_MS,
        );
      })
      .catch(() => setSaveState("idle"));
  }

  function flushPendingSave() {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = editing.current;
    if (pending && dirty.current) {
      dirty.current = false;
      persist(pending.id, pending.title, pending.body);
    }
  }

  function scheduleSave() {
    dirty.current = true;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      const pending = editing.current;
      if (pending && dirty.current) {
        dirty.current = false;
        persist(pending.id, pending.title, pending.body);
      }
    }, AUTOSAVE_DELAY_MS);
  }

  const updateDraft = (patch: Partial<typeof draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    scheduleSave();
  };

  const openEditor = (note: Note) => {
    if (editingId === note.id) return;
    flushPendingSave();
    setEditingId(note.id);
    setDraft({ title: note.title, body: note.body });
    dirty.current = false;
  };

  const closeEditor = () => {
    flushPendingSave();
    setEditingId(null);
  };

  const handleNew = () => {
    flushPendingSave();
    createNote()
      .then((note) => {
        useNotesStore.getState().upsert(note);
        setEditingId(note.id);
        setDraft({ title: "", body: "" });
        dirty.current = false;
      })
      .catch(() => undefined);
  };

  const handleTogglePin = (id: string) => {
    toggleNotePin(id)
      .then((saved) => useNotesStore.getState().upsert(saved))
      .catch(() => undefined);
  };

  const handleDelete = (id: string) => {
    if (editingId === id) {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      dirty.current = false;
      setEditingId(null);
    }
    deleteNote(id)
      .then(() => useNotesStore.getState().remove(id))
      .catch(() => undefined);
  };

  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    if (needle === "") return sorted;
    return sorted.filter(
      (note) =>
        note.title.toLowerCase().includes(needle) ||
        note.body.toLowerCase().includes(needle),
    );
  }, [notes, query]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold">Notes</h2>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-muted">Pinboard</span>
          <IconButton label="New note" size="sm" onClick={handleNew}>
            <Plus size={14} strokeWidth={1.75} />
          </IconButton>
        </div>
      </header>
      <SearchInput value={query} onChange={setQuery} placeholder="Search notes" />
      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          hint="Jot down a thought and Pinboard keeps it, auto-saved."
        />
      ) : visibleNotes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No matches"
          hint="Try a different word or clear the search."
        />
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          {visibleNotes.map((note) =>
            editingId === note.id ? (
              <article
                key={note.id}
                className="flex flex-col rounded-card border border-hairline-strong bg-elevated p-3"
              >
                <input
                  ref={titleInputRef}
                  value={draft.title}
                  placeholder="Title"
                  onChange={(event) =>
                    updateDraft({ title: event.target.value })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeEditor();
                  }}
                  className="bg-transparent text-[13px] font-medium text-ink outline-none placeholder:text-ink-muted"
                />
                <textarea
                  ref={bodyInputRef}
                  value={draft.body}
                  placeholder="Write something…"
                  onChange={(event) => updateDraft({ body: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeEditor();
                  }}
                  className="mt-1.5 min-h-[72px] resize-none bg-transparent text-xs leading-relaxed text-ink-secondary outline-none placeholder:text-ink-muted"
                />
                <footer className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] tabular-nums text-ink-muted">
                    {saveState === "saving"
                      ? "Saving…"
                      : saveState === "saved"
                        ? "Saved"
                        : ""}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <IconButton
                      label={note.pinned ? "Unpin note" : "Pin note"}
                      size="sm"
                      onClick={() => handleTogglePin(note.id)}
                    >
                      {note.pinned ? (
                        <PinOff size={13} strokeWidth={1.75} />
                      ) : (
                        <Pin size={13} strokeWidth={1.75} />
                      )}
                    </IconButton>
                    <IconButton
                      label="Done editing"
                      size="sm"
                      onClick={closeEditor}
                    >
                      <Check size={13} strokeWidth={2} />
                    </IconButton>
                    <IconButton
                      label="Delete note"
                      size="sm"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </footer>
              </article>
            ) : (
              <article
                key={note.id}
                onClick={() => openEditor(note)}
                className="group cursor-pointer rounded-card border border-hairline bg-elevated/60 p-3 transition-colors duration-150 ease-out-quart hover:border-hairline-strong"
              >
                {note.title !== "" && (
                  <h3 className="truncate text-[13px] font-medium text-ink">
                    {note.title}
                  </h3>
                )}
                <p
                  className={`line-clamp-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-secondary ${
                    note.title !== "" ? "mt-1" : ""
                  }`}
                >
                  {note.body !== "" ? (
                    note.body
                  ) : (
                    <span className="text-ink-muted">Empty note</span>
                  )}
                </p>
                <footer className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {note.pinned && (
                      <Pin
                        size={11}
                        strokeWidth={1.75}
                        className="fill-current text-ink-muted"
                      />
                    )}
                    <time
                      dateTime={note.updatedAt}
                      className="text-[10px] tabular-nums text-ink-muted"
                    >
                      {formatTimestamp(note.updatedAt)}
                    </time>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 ease-out-quart group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton
                      label={note.pinned ? "Unpin note" : "Pin note"}
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleTogglePin(note.id);
                      }}
                    >
                      {note.pinned ? (
                        <PinOff size={13} strokeWidth={1.75} />
                      ) : (
                        <Pin size={13} strokeWidth={1.75} />
                      )}
                    </IconButton>
                    <IconButton
                      label="Delete note"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(note.id);
                      }}
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </footer>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(updatedAt: string): string {
  const date = new Date(updatedAt);
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
