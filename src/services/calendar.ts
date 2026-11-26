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
