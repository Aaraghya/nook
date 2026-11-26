import { create } from "zustand";
import {
  clearCalendarEntries,
  deleteCalendarEntry,
  fetchCalendarEntries,
  openCalendarEvent,
  parseCalendarInput,
  saveCalendarEntry,
  toEventDraft,
  type ParsedEvent,
} from "../services/calendar.ts";

export type CalendarPhase = "edit" | "preview";
export const MAX_CALENDAR_ENTRIES = 10;

export interface CalendarEntry {
  id: string;
  input: string;
  phase: CalendarPhase;
  parsed: ParsedEvent | null;
  parseError: string | null;
  submitError: string | null;
}

interface CalendarStore {
  entries: CalendarEntry[];
  activeId: string | null;
  focusNonce: number;
  hydrated: boolean;
  entryLimitError: string | null;
  loadEntries: () => Promise<void>;
  addEntry: () => string | null;
  clearEntries: () => void;
  selectEntry: (id: string) => void;
  collapseEntry: () => void;
  setInput: (id: string, input: string) => void;
  previewEntry: (id: string) => void;
  backToEdit: (id: string) => void;
  deleteEntry: (id: string) => void;
  openInBrowser: (id: string) => Promise<void>;
}

let entrySeq = 1;

function createEntryId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  const id = randomId
    ? `cal-${randomId}`
    : `cal-${Date.now().toString(36)}-${entrySeq}`;
  entrySeq += 1;
  return id;
}

function createEmptyEntry(): CalendarEntry {
  return {
    id: createEntryId(),
    input: "",
    phase: "edit",
    parsed: null,
    parseError: null,
    submitError: null,
  };
}

const initialEntry = createEmptyEntry();

function toCalendarEntry(record: {
  id: string;
  input: string;
  phase: CalendarPhase;
}): CalendarEntry {
  const result = parseCalendarInput(record.input);
  return {
    id: record.id,
    input: record.input,
    phase: record.phase,
    parsed: result.event,
    parseError: result.error,
    submitError: null,
  };
}

function persistEntry(entry: CalendarEntry): void {
  try {
    void saveCalendarEntry({
      id: entry.id,
      input: entry.input,
      phase: entry.phase,
    }).catch(() => {});
  } catch {
    return;
  }
}

function persistDelete(id: string): void {
  try {
    void deleteCalendarEntry(id).catch(() => {});
  } catch {
    return;
  }
}

function persistClearAndEntry(entry: CalendarEntry): void {
  try {
    void clearCalendarEntries()
      .then(() => saveCalendarEntry({ id: entry.id, input: entry.input, phase: entry.phase }))
      .catch(() => {});
  } catch {
    return;
  }
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  entries: [initialEntry],
  activeId: initialEntry.id,
  focusNonce: 0,
  hydrated: false,
  entryLimitError: null,
  loadEntries: async () => {
    if (get().hydrated) return;
    try {
      const savedEntries = await fetchCalendarEntries();
      const loadedEntries = savedEntries.map(toCalendarEntry);
      const nonEmptyEntries = loadedEntries
        .filter((entry) => entry.input.trim() !== "")
        .slice(0, MAX_CALENDAR_ENTRIES);
      const emptyEntry = loadedEntries.find((entry) => entry.input.trim() === "");
      const entries =
        nonEmptyEntries.length > 0
          ? [
              ...nonEmptyEntries,
              ...(nonEmptyEntries.length < MAX_CALENDAR_ENTRIES && emptyEntry
                ? [emptyEntry]
                : []),
            ]
          : [createEmptyEntry()];
      set((state) => ({
        entries,
        activeId: entries[0]?.id ?? null,
        focusNonce: state.focusNonce + 1,
        hydrated: true,
        entryLimitError: null,
      }));
      if (savedEntries.length === 0) {
        persistEntry(entries[0]);
      }
    } catch {
      set({ hydrated: true });
    }
  },
  addEntry: () => {
    const next = createEmptyEntry();
    const currentEntries = get().entries;
    const emptyIds = currentEntries
      .filter((entry) => entry.input.trim() === "")
      .map((entry) => entry.id);
    const occupiedCount = currentEntries.length - emptyIds.length;
    if (currentEntries.length >= MAX_CALENDAR_ENTRIES && occupiedCount >= MAX_CALENDAR_ENTRIES) {
      set({ entryLimitError: "Calendar is full. Delete an entry before adding another." });
      return null;
    }
    if (currentEntries.length >= MAX_CALENDAR_ENTRIES) {
      emptyIds.forEach(persistDelete);
    }
    set((state) => ({
      entries: [
        ...state.entries.filter(
          (entry) => state.entries.length < MAX_CALENDAR_ENTRIES || !emptyIds.includes(entry.id),
        ),
        next,
      ],
      activeId: next.id,
      focusNonce: state.focusNonce + 1,
      entryLimitError: null,
    }));
    persistEntry(next);
    return next.id;
  },
  clearEntries: () => {
    const replacement = createEmptyEntry();
    set((state) => ({
      entries: [replacement],
      activeId: replacement.id,
      focusNonce: state.focusNonce + 1,
      entryLimitError: null,
    }));
    persistClearAndEntry(replacement);
  },
  selectEntry: (id) =>
    set((state) => {
      const target = state.entries.find((entry) => entry.id === id);
      if (!target) return state;
      return {
        activeId: id,
        focusNonce:
          target.phase === "edit" ? state.focusNonce + 1 : state.focusNonce,
      };
    }),
  collapseEntry: () => set({ activeId: null }),
  setInput: (id, input) =>
    set((state) => {
      const result = parseCalendarInput(input);
      const updatedEntry = state.entries.find((entry) => entry.id === id);
      if (!updatedEntry) return state;
      const nextEntry = {
        ...updatedEntry,
        input,
        parsed: result.event,
        parseError: result.error,
        submitError: null,
      };
      persistEntry(nextEntry);
      return {
        entries: state.entries.map((entry) =>
          entry.id === id
            ? nextEntry
            : entry,
        ),
        entryLimitError: null,
      };
    }),
  previewEntry: (id) =>
    set((state) => {
      const target = state.entries.find((entry) => entry.id === id);
      if (!target || target.input.trim() === "") return state;
      const result = parseCalendarInput(target.input);
      const nextEntry = {
        ...target,
        parsed: result.event,
        parseError: result.error,
        phase: "preview" as const,
        submitError: null,
      };
      persistEntry(nextEntry);
      return {
        entries: state.entries.map((entry) =>
          entry.id === id
            ? nextEntry
            : entry,
        ),
      };
    }),
  backToEdit: (id) =>
    set((state) => {
      const target = state.entries.find((entry) => entry.id === id);
      if (!target) return state;
      const nextEntry = { ...target, phase: "edit" as const, submitError: null };
      persistEntry(nextEntry);
      return {
        entries: state.entries.map((entry) => (entry.id === id ? nextEntry : entry)),
        activeId: id,
        focusNonce: state.focusNonce + 1,
      };
    }),
  deleteEntry: (id) =>
    set((state) => {
      const index = state.entries.findIndex((entry) => entry.id === id);
      if (index === -1) return state;
      persistDelete(id);
      if (state.entries.length === 1) {
        const replacement = createEmptyEntry();
        persistEntry(replacement);
        return {
          entries: [replacement],
          activeId: replacement.id,
          focusNonce: state.focusNonce + 1,
          entryLimitError: null,
        };
      }
      const remaining = state.entries.filter((entry) => entry.id !== id);
      let nextActiveId = state.activeId;
      let nextFocusNonce = state.focusNonce;
      if (state.activeId === id) {
        const fallback = remaining[Math.min(index, remaining.length - 1)];
        nextActiveId = fallback.id;
        if (fallback.phase === "edit") {
          nextFocusNonce += 1;
        }
      }
      return {
        entries: remaining,
        activeId: nextActiveId,
        focusNonce: nextFocusNonce,
        entryLimitError: null,
      };
    }),
  openInBrowser: async (id) => {
    const target = get().entries.find((entry) => entry.id === id);
    if (!target || target.parsed === null || target.parseError !== null) {
      return;
    }
    try {
      await openCalendarEvent(toEventDraft(target.parsed));
      get().deleteEntry(id);
    } catch {
      set((state) => ({
        entries: state.entries.map((entry) =>
          entry.id === id
            ? { ...entry, submitError: "Couldn't open your browser. Try again." }
            : entry,
        ),
      }));
    }
  },
}));
