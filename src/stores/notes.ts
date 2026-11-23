import { create } from "zustand";
import type { Note } from "../types";

interface NotesStore {
  notes: Note[];
  setNotes: (notes: Note[]) => void;
  upsert: (note: Note) => void;
  remove: (id: string) => void;
}

export const useNotesStore = create<NotesStore>((set) => ({
  notes: [],
  setNotes: (notes) => set({ notes }),
  upsert: (note) =>
    set((state) => ({
      notes: state.notes.some((existing) => existing.id === note.id)
        ? state.notes.map((existing) =>
            existing.id === note.id ? note : existing,
          )
        : [note, ...state.notes],
    })),
  remove: (id) =>
    set((state) => ({
      notes: state.notes.filter((existing) => existing.id !== id),
    })),
}));
