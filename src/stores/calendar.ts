import { create } from "zustand";
import {
  openCalendarEvent,
  parseEventText,
  toEventDraft,
  type ParsedEvent,
} from "../services/calendar";

type CalendarPhase = "edit" | "preview";

interface CalendarStore {
  input: string;
  phase: CalendarPhase;
  parsed: ParsedEvent | null;
  error: string | null;
  setInput: (input: string) => void;
  preview: () => void;
  backToEdit: () => void;
  openInBrowser: () => Promise<void>;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  input: "",
  phase: "edit",
  parsed: null,
  error: null,
  setInput: (input) => set({ input, error: null }),
  preview: () => {
    const { input } = get();
    if (input.trim() === "") return;
    set({ parsed: parseEventText(input), phase: "preview", error: null });
  },
  backToEdit: () => set({ phase: "edit" }),
  openInBrowser: async () => {
    const { parsed } = get();
    if (parsed === null) return;
    try {
      await openCalendarEvent(toEventDraft(parsed));
      set({ input: "", phase: "edit", parsed: null, error: null });
    } catch {
      set({ error: "Couldn't open your browser. Try again." });
    }
  },
}));
