import {
  Check,
  Copy,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  copySnippet,
  createSnippet,
  deleteSnippet,
  fetchSnippets,
  saveSnippet,
} from "../../services/snippets";
import { useSnippetsStore } from "../../stores/snippets";
import type { Snippet } from "../../types";
import { EmptyState } from "../common/EmptyState";
import { IconButton } from "../common/IconButton";
import { SearchInput } from "../common/SearchInput";

const AUTOSAVE_DELAY_MS = 600;
const SAVED_FEEDBACK_MS = 1400;
const COPY_FEEDBACK_MS = 1200;

type SaveState = "idle" | "saving" | "saved";

interface SnippetDraft {
  label: string;
  content: string;
  category: string;
}

const EMPTY_DRAFT: SnippetDraft = { label: "", content: "", category: "" };

export function SnippetsPanel() {
  const snippets = useSnippetsStore((s) => s.snippets);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SnippetDraft>(EMPTY_DRAFT);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const labelInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<number | null>(null);
  const savedTimer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const editing = useRef<{ id: string } & SnippetDraft | null>(null);

  editing.current = editingId ? { id: editingId, ...draft } : null;

  useEffect(() => {
    let cancelled = false;
    fetchSnippets().then((loaded) => {
      if (!cancelled) useSnippetsStore.getState().setSnippets(loaded);
    });
    return () => {
      cancelled = true;
      flushPendingSave();
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!editingId) return;
    labelInputRef.current?.focus();
  }, [editingId]);

  function persist(id: string, fields: SnippetDraft) {
    setSaveState("saving");
    saveSnippet(id, fields.label, fields.content, fields.category)
      .then((saved) => {
        useSnippetsStore.getState().upsert(saved);
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
      persist(pending.id, {
        label: pending.label,
        content: pending.content,
        category: pending.category,
      });
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
        persist(pending.id, {
          label: pending.label,
          content: pending.content,
          category: pending.category,
        });
      }
    }, AUTOSAVE_DELAY_MS);
  }

  const updateDraft = (patch: Partial<SnippetDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    scheduleSave();
  };

  const openEditor = (snippet: Snippet) => {
    if (editingId === snippet.id) return;
    flushPendingSave();
    setEditingId(snippet.id);
    setDraft({
      label: snippet.label,
      content: snippet.content,
      category: snippet.category,
    });
    dirty.current = false;
  };

  const closeEditor = () => {
    flushPendingSave();
    setEditingId(null);
  };

  const handleNew = () => {
    flushPendingSave();
    createSnippet("", "", "")
      .then((snippet) => {
        useSnippetsStore.getState().upsert(snippet);
        setEditingId(snippet.id);
        setDraft(EMPTY_DRAFT);
        dirty.current = false;
      })
      .catch(() => undefined);
  };

  const handleCopy = (id: string) => {
    copySnippet(id)
      .then(() => {
        setCopiedId(id);
        if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(
          () => setCopiedId(null),
          COPY_FEEDBACK_MS,
        );
      })
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
    deleteSnippet(id)
      .then(() => useSnippetsStore.getState().remove(id))
      .catch(() => undefined);
  };

  const visibleSnippets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...snippets].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    if (needle === "") return sorted;
    return sorted.filter(
      (snippet) =>
        snippet.label.toLowerCase().includes(needle) ||
        snippet.content.toLowerCase().includes(needle) ||
        snippet.category.toLowerCase().includes(needle),
    );
  }, [snippets, query]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold">Snippets</h2>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-muted">Pinned</span>
          <IconButton label="New snippet" size="sm" onClick={handleNew}>
            <Plus size={14} strokeWidth={1.75} />
          </IconButton>
        </div>
      </header>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search snippets"
      />
      {snippets.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="No snippets yet"
          hint="Save the bits you type over and over for one-click reuse."
        />
      ) : visibleSnippets.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="No matches"
          hint="Try a different word or clear the search."
        />
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          {visibleSnippets.map((snippet) =>
            editingId === snippet.id ? (
              <article
                key={snippet.id}
                className="flex flex-col rounded-card border border-hairline-strong bg-elevated p-3"
              >
                <input
                  ref={labelInputRef}
                  value={draft.label}
                  placeholder="Label"
                  onChange={(event) =>
                    updateDraft({ label: event.target.value })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeEditor();
                  }}
                  className="bg-transparent text-[13px] font-medium text-ink outline-none placeholder:text-ink-muted"
                />
                <div className="mt-1.5 flex items-center gap-1.5 rounded-control border border-hairline bg-elevated/60 px-2 py-1">
                  <Tag
                    size={11}
                    strokeWidth={1.75}
                    className="shrink-0 text-ink-muted"
                  />
                  <input
                    value={draft.category}
                    placeholder="Category"
                    onChange={(event) =>
                      updateDraft({ category: event.target.value })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Escape") closeEditor();
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[11px] text-ink-secondary outline-none placeholder:text-ink-muted"
                  />
                </div>
                <textarea
                  ref={contentInputRef}
                  value={draft.content}
                  placeholder="Paste the text you reuse…"
                  onChange={(event) =>
                    updateDraft({ content: event.target.value })
                  }
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
                  <IconButton
                    label="Done editing"
                    size="sm"
                    onClick={closeEditor}
                  >
                    <Check size={13} strokeWidth={2} />
                  </IconButton>
                </footer>
              </article>
            ) : (
              <article
                key={snippet.id}
                className="group rounded-card border border-hairline bg-elevated/60 p-3 transition-colors duration-150 ease-out-quart hover:border-hairline-strong"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-[13px] font-medium text-ink">
                    {snippet.label !== "" ? (
                      snippet.label
                    ) : (
                      <span className="text-ink-muted">Untitled snippet</span>
                    )}
                  </h3>
                  {snippet.category !== "" && (
                    <span className="shrink-0 rounded-full border border-hairline bg-raised px-2 py-0.5 text-[10px] text-ink-muted">
                      {snippet.category}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-secondary">
                  {snippet.content !== "" ? (
                    snippet.content
                  ) : (
                    <span className="text-ink-muted">Empty snippet</span>
                  )}
                </p>
                <footer className="mt-2 flex items-center justify-between">
                  <time
                    dateTime={snippet.updatedAt}
                    className="text-[10px] tabular-nums text-ink-muted"
                  >
                    {formatTimestamp(snippet.updatedAt)}
                  </time>
                  <div
                    className={`flex items-center gap-0.5 transition-opacity duration-150 ease-out-quart ${
                      copiedId === snippet.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    }`}
                  >
                    <IconButton
                      label="Copy snippet"
                      size="sm"
                      onClick={() => handleCopy(snippet.id)}
                    >
                      {copiedId === snippet.id ? (
                        <Check size={13} strokeWidth={2} />
                      ) : (
                        <Copy size={13} strokeWidth={1.75} />
                      )}
                    </IconButton>
                    <IconButton
                      label="Edit snippet"
                      size="sm"
                      onClick={() => openEditor(snippet)}
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                    </IconButton>
                    <IconButton
                      label="Delete snippet"
                      size="sm"
                      onClick={() => handleDelete(snippet.id)}
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
