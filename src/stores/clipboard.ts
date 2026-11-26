import { create } from "zustand";
import type { ClipboardEntry } from "../types";

export function sortClipboardEntries(entries: ClipboardEntry[]): ClipboardEntry[] {
  return [...entries].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const timeDiff = Date.parse(b.capturedAt) - Date.parse(a.capturedAt);
    if (timeDiff !== 0) return timeDiff;
    return Number(b.id) - Number(a.id);
  });
}

interface ClipboardStore {
  entries: ClipboardEntry[];
  applyEntries: (entries: ClipboardEntry[]) => void;
  applyNewEntry: (entry: ClipboardEntry) => void;
  togglePin: (id: string) => void;
  deleteEntry: (id: string) => void;
  clear: () => void;
}

export const useClipboardStore = create<ClipboardStore>((set) => ({
  entries: [],
  applyEntries: (entries) => set({ entries: sortClipboardEntries(entries) }),
  applyNewEntry: (entry) =>
    set((state) => {
      if (
        state.entries.some(
          (existing) => existing.pinned && existing.content === entry.content,
        )
      ) {
        return state;
      }
      const filtered = state.entries.filter(
        (existing) => existing.content !== entry.content,
      );
      return {
        entries: sortClipboardEntries([entry, ...filtered]),
      };
    }),
  togglePin: (id) =>
    set((state) => ({
      entries: sortClipboardEntries(
        state.entries.map((entry) =>
          entry.id === id ? { ...entry, pinned: !entry.pinned } : entry,
        ),
      ),
    })),
  deleteEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
    })),
  clear: () => set({ entries: [] }),
}));
