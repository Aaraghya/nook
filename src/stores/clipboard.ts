import { create } from "zustand";
import type { ClipboardEntry } from "../types";

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
  applyEntries: (entries) => set({ entries }),
  applyNewEntry: (entry) =>
    set((state) => ({
      entries: [
        entry,
        ...state.entries.filter(
          (existing) => existing.content !== entry.content,
        ),
      ],
    })),
  togglePin: (id) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id ? { ...entry, pinned: !entry.pinned } : entry,
      ),
    })),
  deleteEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
    })),
  clear: () => set({ entries: [] }),
}));
