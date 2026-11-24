import { invoke } from "@tauri-apps/api/core";

export interface ParsedEvent {
  title: string;
  start: Date;
  end: Date;
  location: string | null;
  details: string | null;
}

export interface CalendarEventDraft {
  title: string;
  startUtc: string;
  endUtc: string;
  location: string | null;
  details: string | null;
}

interface Span {
  start: number;
  end: number;
}

interface TimeInfo {
  hour: number;
  minute: number;
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const TIME_12H_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/g;
const TIME_24H_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
const RANGE_SHARED_MERIDIEM_RE =
  /\b(\d{1,2})(?::(\d{2}))?\s*(?:-|–|—|to|till|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/g;
const DATE_WORD_RE =
  /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g;
const DURATION_RE = /\bfor\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/g;
const AT_RE = /\bat\b/g;

const DEFAULT_START: TimeInfo = { hour: 9, minute: 0 };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toGCalUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export function toEventDraft(parsed: ParsedEvent): CalendarEventDraft {
  return {
    title: parsed.title,
    startUtc: toGCalUtc(parsed.start),
    endUtc: toGCalUtc(parsed.end),
    location: parsed.location,
    details: parsed.details,
  };
}

export function parseEventText(raw: string): ParsedEvent {
  const lower = raw.toLowerCase();
  const spans: Span[] = [];
  const times: TimeInfo[] = [];
  let durationMinutes: number | null = null;
  let dateWord: "today" | "tomorrow" | "weekday" | null = null;
  let weekdayIndex: number | null = null;

  const overlaps = (start: number, end: number) =>
    spans.some((span) => start < span.end && end > span.start);

  for (const match of lower.matchAll(RANGE_SHARED_MERIDIEM_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const to24 = (hour: number) =>
      (hour % 12) + (match[5] === "pm" ? 12 : 0);
    times.push({
      hour: to24(Number(match[1])),
      minute: match[2] ? Number(match[2]) : 0,
    });
    times.push({
      hour: to24(Number(match[3])),
      minute: match[4] ? Number(match[4]) : 0,
    });
    spans.push({ start, end });
  }

  for (const match of lower.matchAll(TIME_12H_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const hour12 = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const hour = (hour12 % 12) + (match[3] === "pm" ? 12 : 0);
    times.push({ hour, minute });
    spans.push({ start, end });
  }

  for (const match of lower.matchAll(TIME_24H_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    times.push({ hour: Number(match[1]), minute: Number(match[2]) });
    spans.push({ start, end });
  }

  for (const match of lower.matchAll(DATE_WORD_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const word = match[1];
    if (word === "today" || word === "tomorrow") {
      dateWord = word;
    } else {
      dateWord = "weekday";
      weekdayIndex = WEEKDAYS.indexOf(word as (typeof WEEKDAYS)[number]);
    }
    spans.push({ start, end });
  }

  for (const match of lower.matchAll(DURATION_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const amount = Number(match[1]);
    durationMinutes =
      match[2][0] === "h" ? Math.round(amount * 60) : Math.round(amount);
    spans.push({ start, end });
  }

  let location: string | null = null;
  const atPositions: number[] = [];
  for (const match of lower.matchAll(AT_RE)) {
    const atStart = match.index ?? 0;
    const afterAt = lower.slice(atStart + 2);
    if (/^\s*(\d|$)/.test(afterAt)) continue;
    atPositions.push(atStart);
  }
  if (atPositions.length > 0) {
    const atStart = atPositions[atPositions.length - 1];
    const innerSpans = spans
      .filter((span) => span.start >= atStart)
      .sort((a, b) => a.start - b.start);
    let text = "";
    let cursor = atStart + 2;
    for (const span of innerSpans) {
      text += raw.slice(cursor, span.start);
      cursor = span.end;
    }
    text += raw.slice(cursor);
    const cleaned = text
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s+(?:at|on|for|to|till|until)$/i, "")
      .replace(/^[\s,;:]+|[\s,;:]+$/g, "")
      .trim();
    if (cleaned !== "") {
      location = cleaned;
      spans.push({ start: atStart, end: raw.length });
    }
  }

  let title = "";
  let cursor = 0;
  const appendSegment = (segment: string) => {
    const core = segment.replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "").trim();
    if (/^(?:to|at|on|for|from|until|till)$/i.test(core)) return;
    title += segment;
  };
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start < cursor) continue;
    appendSegment(raw.slice(cursor, span.start));
    cursor = span.end;
  }
  appendSegment(raw.slice(cursor));
  title = title
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+(?:at|on|for)$/i, "")
    .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "")
    .trim();
  if (title === "") title = raw.trim();

  const now = new Date();
  const startTime = times[0] ?? DEFAULT_START;
  let day: Date;
  if (dateWord === "today") {
    day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (dateWord === "weekday") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = ((weekdayIndex ?? 0) - today.getDay() + 7) % 7;
    day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
    const candidateStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      startTime.hour,
      startTime.minute,
    );
    if (diff === 0 && candidateStart <= now) {
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 7);
    }
  } else {
    day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    startTime.hour,
    startTime.minute,
  );
  let end: Date;
  if (times.length >= 2) {
    const second = times[1];
    end = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      second.hour,
      second.minute,
    );
    if (end <= start) {
      end = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate() + 1,
        second.hour,
        second.minute,
      );
    }
  } else {
    end = new Date(start.getTime() + (durationMinutes ?? 60) * 60_000);
  }

  return { title, start, end, location, details: null };
}

export function openCalendarEvent(draft: CalendarEventDraft): Promise<void> {
  return invoke("calendar_open_event", { draft });
}
