import { invoke } from "@tauri-apps/api/core";
import {
  parseCalendarInput,
  parseEventText,
  toEventDraft,
  toGCalUtc,
  type CalendarEventDraft,
  type ParseResult,
  type ParsedEvent,
} from "./calendarParser.ts";

export {
  parseCalendarInput,
  parseEventText,
  toEventDraft,
  toGCalUtc,
  type CalendarEventDraft,
  type ParseResult,
  type ParsedEvent,
};

export function openCalendarEvent(draft: CalendarEventDraft): Promise<void> {
  return invoke("calendar_open_event", { draft });
}

export interface CalendarEntryRecord {
  id: string;
  input: string;
  phase: "edit" | "preview";
  createdAtMs: number;
  updatedAtMs: number;
}

export function fetchCalendarEntries(): Promise<CalendarEntryRecord[]> {
  return invoke<CalendarEntryRecord[]>("calendar_get_entries");
}

export function saveCalendarEntry(entry: {
  id: string;
  input: string;
  phase: "edit" | "preview";
}): Promise<void> {
  return invoke("calendar_save_entry", { entry });
}

export function deleteCalendarEntry(id: string): Promise<void> {
  return invoke("calendar_delete_entry", { id });
}

export function clearCalendarEntries(): Promise<void> {
  return invoke("calendar_clear_entries");
}
