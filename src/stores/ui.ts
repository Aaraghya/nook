import { create } from "zustand";
import type { TabId } from "../types";

interface UiState {
  /** Currently open section in the panel. */
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

/**
 * UI-only state (which tab is open, etc.). Module data lives in its own
 * store per feature (music, clipboard, snippets) once those
 * milestones land, keeping this store trivial and predictable.
 */
export const useUiStore = create<UiState>((set) => ({
  activeTab: "clipboard",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
