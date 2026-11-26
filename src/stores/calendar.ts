import { create } from "zustand";
import {
  openCalendarEvent,
  parseCalendarInput,
  toEventDraft,
  type ParsedEvent,
} from "../services/calendar.ts";

export type CalendarPhase = "edit" | "preview";

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
  addEntry: () => string;
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
  const id = `cal-${entrySeq}`;
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

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  entries: [initialEntry],
  activeId: initialEntry.id,
  focusNonce: 0,
  addEntry: () => {
    const next = createEmptyEntry();
    set((state) => ({
      entries: [...state.entries, next],
      activeId: next.id,
      focusNonce: state.focusNonce + 1,
    }));
    return next.id;
  },
  clearEntries: () => {
    const replacement = createEmptyEntry();
    set((state) => ({
      entries: [replacement],
      activeId: replacement.id,
      focusNonce: state.focusNonce + 1,
    }));
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
      return {
        entries: state.entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                input,
                parsed: result.event,
                parseError: result.error,
                submitError: null,
              }
            : entry,
        ),
      };
    }),
  previewEntry: (id) =>
    set((state) => {
      const target = state.entries.find((entry) => entry.id === id);
      if (!target || target.input.trim() === "") return state;
      const result = parseCalendarInput(target.input);
      return {
        entries: state.entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                parsed: result.event,
                parseError: result.error,
                phase: "preview",
                submitError: null,
              }
            : entry,
        ),
      };
    }),
  backToEdit: (id) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id
          ? { ...entry, phase: "edit", submitError: null }
          : entry,
      ),
      activeId: id,
      focusNonce: state.focusNonce + 1,
    })),
  deleteEntry: (id) =>
    set((state) => {
      const index = state.entries.findIndex((entry) => entry.id === id);
      if (index === -1) return state;
      if (state.entries.length === 1) {
        const replacement = createEmptyEntry();
        return {
          entries: [replacement],
          activeId: replacement.id,
          focusNonce: state.focusNonce + 1,
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
