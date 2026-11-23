import { create } from "zustand";
import type { Snippet } from "../types";

interface SnippetsStore {
  snippets: Snippet[];
  setSnippets: (snippets: Snippet[]) => void;
  upsert: (snippet: Snippet) => void;
  remove: (id: string) => void;
}

export const useSnippetsStore = create<SnippetsStore>((set) => ({
  snippets: [],
  setSnippets: (snippets) => set({ snippets }),
  upsert: (snippet) =>
    set((state) => ({
      snippets: state.snippets.some((existing) => existing.id === snippet.id)
        ? state.snippets.map((existing) =>
            existing.id === snippet.id ? snippet : existing,
          )
        : [snippet, ...state.snippets],
    })),
  remove: (id) =>
    set((state) => ({
      snippets: state.snippets.filter((existing) => existing.id !== id),
    })),
}));
