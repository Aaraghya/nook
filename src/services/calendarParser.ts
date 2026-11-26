export interface ParsedEvent {
  title: string;
  start: Date;
  end: Date;
  location: string | null;
  details: string | null;
}

export interface ParseResult {
  event: ParsedEvent | null;
  error: string | null;
  hasExplicitDate: boolean;
  hasExplicitTime: boolean;
  hasExplicitDuration: boolean;
  isValid: boolean;
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

interface ResolvedTimeRange {
  start: TimeInfo;
  end: TimeInfo | null;
}

type DateValue =
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "day_after_tomorrow" }
  | { kind: "weekday"; modifier: "this" | "next" | null; weekdayIndex: number }
  | { kind: "explicit"; year: number; month: number; day: number }
  | { kind: "month_day"; month: number; day: number };

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const DEFAULT_START: TimeInfo = { hour: 9, minute: 0 };

const COMPOUND_DURATION_RE =
  /\bfor\s+(an?|half\s+an?|\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h)(?:\s*(?:and\s+)?(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m))?\b/gi;
const MINUTE_DURATION_RE =
  /\bfor\s+(an?|\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m)\b/gi;

const ISO_DATE_RE =
  /(?<![:/\-\d])(?:on\s+)?(\d{4})([/-])(\d{1,2})\2(\d{1,2})(?![:/\-\d])/gi;
const DMY_DATE_RE =
  /(?<![:/\-\d])(?:on\s+)?(\d{1,2})([/-])(\d{1,2})\2(\d{2,4})(?![:/\-\d])/gi;
const DM_DATE_RE =
  /(?<![:/\-\d])\bon\s+(\d{1,2})\/(\d{1,2})(?![:/\-\d])/gi;
const DAY_MONTH_RE =
  /\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?:,?\s+(\d{4}))?\b/gi;
const MONTH_DAY_RE =
  /\b(?:on\s+)?(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;
const DAY_AFTER_TOMORROW_RE =
  /\b(?:on\s+)?(?:the\s+)?day\s+after\s+tomorrow\b/gi;
const RELATIVE_DAY_RE = /\b(?:on\s+)?(today|tomorrow)\b/gi;
const WEEKDAY_RE =
  /\b(?:on\s+)?(?:(this|next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

const TIME_TOKEN =
  "(?:noon|midnight|\\d{1,2}(?::\\d{2})?(?:\\s*(?:am|pm))?)";
const BETWEEN_RANGE_RE = new RegExp(
  `\\bbetween\\s+(${TIME_TOKEN})\\s+and\\s+(${TIME_TOKEN})(?![:/\\-\\d])\\b`,
  "gi",
);
const CONNECTOR_RANGE_RE = new RegExp(
  `(?:\\b(?:from|at)\\s+)?(?<![:/\\-\\d])(${TIME_TOKEN})\\s*(?:-|–|—|\\bto\\b|\\btill\\b|\\buntil\\b)\\s*(${TIME_TOKEN})(?![:/\\-\\d])\\b`,
  "gi",
);
const NAMED_TIME_RE = /\b(?:at\s+)?(noon|midnight)\b/gi;
const TIME_12H_RE =
  /(?:\bat\s+)?(?<![:/\-\d])(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
const TIME_24H_RE =
  /(?:\bat\s+)?(?<![:/\-\d])(\d{1,2}):(\d{2})(?!\s*(?:am|pm)|[:/\-\d])\b/gi;
const AT_RE = /\bat\b/gi;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toGCalUtc(date: Date): string {
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

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

function parseQuantity(token: string): number {
  const lower = token.toLowerCase().trim();
  if (lower === "a" || lower === "an") return 1;
  if (lower === "half a" || lower === "half an") return 0.5;
  return Number(lower);
}

interface ParsedTokenTime {
  kind: "named" | "12h" | "24h" | "bare";
  hour: number;
  minute: number;
  meridiem: "am" | "pm" | null;
}

function parseTimeToken(token: string): ParsedTokenTime | null {
  const trimmed = token.trim().toLowerCase();
  if (trimmed === "noon") {
    return { kind: "named", hour: 12, minute: 0, meridiem: "pm" };
  }
  if (trimmed === "midnight") {
    return { kind: "named", hour: 0, minute: 0, meridiem: "am" };
  }
  const m12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m12) {
    return {
      kind: "12h",
      hour: Number(m12[1]),
      minute: m12[2] ? Number(m12[2]) : 0,
      meridiem: m12[3] as "am" | "pm",
    };
  }
  const m24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    return {
      kind: "24h",
      hour: Number(m24[1]),
      minute: Number(m24[2]),
      meridiem: null,
    };
  }
  const mBare = trimmed.match(/^(\d{1,2})$/);
  if (mBare) {
    return {
      kind: "bare",
      hour: Number(mBare[1]),
      minute: 0,
      meridiem: null,
    };
  }
  return null;
}

function to24Hour(hour12: number, meridiem: "am" | "pm"): number {
  return (hour12 % 12) + (meridiem === "pm" ? 12 : 0);
}

function resolveTokenToTimeInfo(
  token: ParsedTokenTime,
  fallbackMeridiem: "am" | "pm" | null,
): { time: TimeInfo | null; error: string | null } {
  if (token.kind === "named") {
    return { time: { hour: token.hour, minute: token.minute }, error: null };
  }
  if (token.kind === "12h" && token.meridiem !== null) {
    if (token.hour < 1 || token.hour > 12 || token.minute < 0 || token.minute > 59) {
      return { time: null, error: "Invalid 12-hour time expression" };
    }
    return {
      time: { hour: to24Hour(token.hour, token.meridiem), minute: token.minute },
      error: null,
    };
  }
  if (token.kind === "24h") {
    if (fallbackMeridiem !== null) {
      if (token.hour < 1 || token.hour > 12 || token.minute < 0 || token.minute > 59) {
        return { time: null, error: "Invalid time expression" };
      }
      return {
        time: { hour: to24Hour(token.hour, fallbackMeridiem), minute: token.minute },
        error: null,
      };
    }
    if (token.hour < 0 || token.hour > 23 || token.minute < 0 || token.minute > 59) {
      return { time: null, error: "Invalid 24-hour time expression" };
    }
    return { time: { hour: token.hour, minute: token.minute }, error: null };
  }
  if (token.kind === "bare" && fallbackMeridiem !== null) {
    if (token.hour < 1 || token.hour > 12) {
      return { time: null, error: "Invalid time range expression" };
    }
    return {
      time: { hour: to24Hour(token.hour, fallbackMeridiem), minute: 0 },
      error: null,
    };
  }
  return { time: null, error: "Ambiguous time range expression" };
}

function resolveRangeTokens(
  leftRaw: string,
  rightRaw: string,
  rawMatch: string,
): { range: ResolvedTimeRange | null; error: string | null; skip: boolean } {
  const left = parseTimeToken(leftRaw);
  const right = parseTimeToken(rightRaw);
  if (left === null || right === null) {
    return { range: null, error: null, skip: true };
  }

  const leftExplicit = left.kind !== "bare";
  const rightExplicit = right.kind !== "bare";

  if (!leftExplicit && !rightExplicit) {
    return { range: null, error: null, skip: true };
  }

  if (leftExplicit && right.kind === "bare") {
    return { range: null, error: null, skip: true };
  }

  if (!leftExplicit && right.kind === "24h") {
    return { range: null, error: null, skip: true };
  }

  if (left.kind === "bare" || (left.kind === "24h" && right.meridiem !== null)) {
    const rightMeridiem = right.meridiem;
    if (rightMeridiem === null) {
      return { range: null, error: null, skip: true };
    }
    if (left.hour < 1 || left.hour > 12 || left.minute < 0 || left.minute > 59) {
      return {
        range: null,
        error: `Invalid time in range: "${rawMatch.trim()}"`,
        skip: false,
      };
    }
    const endResolved = resolveTokenToTimeInfo(right, null);
    if (endResolved.error !== null || endResolved.time === null) {
      return {
        range: null,
        error: `Invalid time in range: "${rawMatch.trim()}"`,
        skip: false,
      };
    }
    const sameMeridiemHour = to24Hour(left.hour, rightMeridiem);
    const sameMinutes = sameMeridiemHour * 60 + left.minute;
    const endMinutes = endResolved.time.hour * 60 + endResolved.time.minute;
    const chosenMeridiem: "am" | "pm" =
      sameMinutes < endMinutes
        ? rightMeridiem
        : rightMeridiem === "pm"
          ? "am"
          : "pm";
    const startHour = to24Hour(left.hour, chosenMeridiem);
    return {
      range: {
        start: { hour: startHour, minute: left.minute },
        end: endResolved.time,
      },
      error: null,
      skip: false,
    };
  }

  const startResolved = resolveTokenToTimeInfo(left, null);
  const endResolved = resolveTokenToTimeInfo(right, null);
  if (
    startResolved.error !== null ||
    endResolved.error !== null ||
    startResolved.time === null ||
    endResolved.time === null
  ) {
    return {
      range: null,
      error: `Invalid time in range: "${rawMatch.trim()}"`,
      skip: false,
    };
  }
  return {
    range: {
      start: startResolved.time,
      end: endResolved.time,
    },
    error: null,
    skip: false,
  };
}

function resolveDateValue(
  dateValue: DateValue,
  now: Date,
  startTime: TimeInfo,
): { date: Date | null; error: string | null } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateValue.kind === "today") {
    return { date: today, error: null };
  }
  if (dateValue.kind === "tomorrow") {
    return {
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
      error: null,
    };
  }
  if (dateValue.kind === "day_after_tomorrow") {
    return {
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2),
      error: null,
    };
  }
  if (dateValue.kind === "weekday") {
    if (dateValue.modifier === "next") {
      const isoToday = (today.getDay() + 6) % 7;
      const isoTarget = (dateValue.weekdayIndex + 6) % 7;
      const daysToNextMonday = 7 - isoToday;
      const offset = daysToNextMonday + isoTarget;
      return {
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset),
        error: null,
      };
    }
    let diff = (dateValue.weekdayIndex - today.getDay() + 7) % 7;
    let day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
    if (dateValue.modifier === null && diff === 0) {
      const candidateStart = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        startTime.hour,
        startTime.minute,
      );
      if (candidateStart <= now) {
        day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 7);
      }
    }
    return { date: day, error: null };
  }
  if (dateValue.kind === "explicit") {
    if (!isValidCalendarDate(dateValue.year, dateValue.month, dateValue.day)) {
      return { date: null, error: "Invalid calendar date" };
    }
    return {
      date: new Date(dateValue.year, dateValue.month - 1, dateValue.day),
      error: null,
    };
  }

  let year = today.getFullYear();
  if (dateValue.month === 2 && dateValue.day === 29) {
    while (!isLeapYear(year) || new Date(year, 1, 29) < today) {
      year += 1;
      if (year > today.getFullYear() + 8) {
        return { date: null, error: "Invalid calendar date" };
      }
    }
    return { date: new Date(year, 1, 29), error: null };
  }
  if (!isValidCalendarDate(year, dateValue.month, dateValue.day)) {
    return { date: null, error: "Invalid calendar date" };
  }
  let candidate = new Date(year, dateValue.month - 1, dateValue.day);
  if (candidate < today) {
    candidate = new Date(year + 1, dateValue.month - 1, dateValue.day);
  }
  return { date: candidate, error: null };
}

export function parseCalendarInput(
  raw: string,
  referenceNow: Date = new Date(),
): ParseResult {
  if (raw.trim() === "") {
    return {
      event: null,
      error: null,
      hasExplicitDate: false,
      hasExplicitTime: false,
      hasExplicitDuration: false,
      isValid: false,
    };
  }

  const spans: Span[] = [];
  const errors: string[] = [];
  const dateMatches: DateValue[] = [];
  const timeRanges: ResolvedTimeRange[] = [];
  let durationMinutes: number | null = null;
  let durationCount = 0;

  const overlaps = (start: number, end: number) =>
    spans.some((span) => start < span.end && end > span.start);

  for (const match of raw.matchAll(COMPOUND_DURATION_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const hours = parseQuantity(match[1]);
    const mins = match[3] ? parseQuantity(match[3]) : 0;
    const total = Math.round(hours * 60 + mins);
    if (!Number.isFinite(total) || total <= 0) {
      errors.push(`Invalid duration: "${match[0].trim()}"`);
    } else {
      durationMinutes = total;
      durationCount += 1;
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(MINUTE_DURATION_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const mins = parseQuantity(match[1]);
    const total = Math.round(mins);
    if (!Number.isFinite(total) || total <= 0) {
      errors.push(`Invalid duration: "${match[0].trim()}"`);
    } else {
      durationMinutes = total;
      durationCount += 1;
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(ISO_DATE_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const year = Number(match[1]);
    const month = Number(match[3]);
    const day = Number(match[4]);
    if (!isValidCalendarDate(year, month, day)) {
      errors.push(`Invalid date: "${match[0].trim()}"`);
    } else {
      dateMatches.push({ kind: "explicit", year, month, day });
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(DMY_DATE_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const day = Number(match[1]);
    const month = Number(match[3]);
    const rawYear = Number(match[4]);
    const year = match[4].length === 2 ? 2000 + rawYear : rawYear;
    if (!isValidCalendarDate(year, month, day)) {
      errors.push(`Invalid date: "${match[0].trim()}"`);
    } else {
      dateMatches.push({ kind: "explicit", year, month, day });
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(DM_DATE_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(2024, month)) {
      errors.push(`Invalid date: "${match[0].trim()}"`);
    } else {
      dateMatches.push({ kind: "month_day", month, day });
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(DAY_MONTH_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const day = Number(match[1]);
    const month = MONTHS[match[2].toLowerCase()];
    const year = match[3] ? Number(match[3]) : null;
    if (year !== null) {
      if (!isValidCalendarDate(year, month, day)) {
        errors.push(`Invalid date: "${match[0].trim()}"`);
      } else {
        dateMatches.push({ kind: "explicit", year, month, day });
      }
    } else {
      if (day < 1 || day > daysInMonth(2024, month)) {
        errors.push(`Invalid date: "${match[0].trim()}"`);
      } else {
        dateMatches.push({ kind: "month_day", month, day });
      }
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(MONTH_DAY_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const month = MONTHS[match[1].toLowerCase()];
    const day = Number(match[2]);
    const year = match[3] ? Number(match[3]) : null;
    if (year !== null) {
      if (!isValidCalendarDate(year, month, day)) {
        errors.push(`Invalid date: "${match[0].trim()}"`);
      } else {
        dateMatches.push({ kind: "explicit", year, month, day });
      }
    } else {
      if (day < 1 || day > daysInMonth(2024, month)) {
        errors.push(`Invalid date: "${match[0].trim()}"`);
      } else {
        dateMatches.push({ kind: "month_day", month, day });
      }
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(DAY_AFTER_TOMORROW_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    dateMatches.push({ kind: "day_after_tomorrow" });
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(RELATIVE_DAY_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const word = match[1].toLowerCase();
    dateMatches.push({ kind: word === "today" ? "today" : "tomorrow" });
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(WEEKDAY_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const modifierRaw = match[1]?.toLowerCase();
    const modifier =
      modifierRaw === "this" || modifierRaw === "next" ? modifierRaw : null;
    const weekdayIndex = WEEKDAYS.indexOf(
      match[2].toLowerCase() as (typeof WEEKDAYS)[number],
    );
    dateMatches.push({ kind: "weekday", modifier, weekdayIndex });
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(BETWEEN_RANGE_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const resolved = resolveRangeTokens(match[1], match[2], match[0]);
    if (resolved.skip) continue;
    if (resolved.error !== null) {
      errors.push(resolved.error);
    } else if (resolved.range !== null) {
      timeRanges.push(resolved.range);
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(CONNECTOR_RANGE_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const resolved = resolveRangeTokens(match[1], match[2], match[0]);
    if (resolved.skip) continue;
    if (resolved.error !== null) {
      errors.push(resolved.error);
    } else if (resolved.range !== null) {
      timeRanges.push(resolved.range);
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(NAMED_TIME_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const word = match[1].toLowerCase();
    timeRanges.push({
      start: word === "noon" ? { hour: 12, minute: 0 } : { hour: 0, minute: 0 },
      end: null,
    });
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(TIME_12H_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const hour12 = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const meridiem = match[3].toLowerCase() as "am" | "pm";
    if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) {
      errors.push(`Invalid time: "${match[0].trim()}"`);
    } else {
      timeRanges.push({
        start: { hour: to24Hour(hour12, meridiem), minute },
        end: null,
      });
    }
    spans.push({ start, end });
  }

  for (const match of raw.matchAll(TIME_24H_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      errors.push(`Invalid time: "${match[0].trim()}"`);
    } else {
      timeRanges.push({
        start: { hour, minute },
        end: null,
      });
    }
    spans.push({ start, end });
  }

  if (dateMatches.length > 1) {
    errors.push("Multiple date expressions found; please specify one date");
  }
  if (timeRanges.length > 1) {
    errors.push("Multiple time expressions found; please specify one time or range");
  }
  if (durationCount > 1) {
    errors.push("Multiple duration expressions found; please specify one duration");
  }
  if (timeRanges.length === 1 && timeRanges[0].end !== null && durationMinutes !== null) {
    const startMins = timeRanges[0].start.hour * 60 + timeRanges[0].start.minute;
    let endMins = timeRanges[0].end.hour * 60 + timeRanges[0].end.minute;
    if (endMins <= startMins) endMins += 24 * 60;
    if (endMins - startMins !== durationMinutes) {
      errors.push("Conflicting time range and duration");
    }
  }

  let location: string | null = null;
  const atPositions: number[] = [];
  for (const match of raw.matchAll(AT_RE)) {
    const atStart = match.index ?? 0;
    const atEnd = atStart + 2;
    if (overlaps(atStart, atEnd)) continue;
    const afterAt = raw.slice(atEnd);
    const trimmedAfter = afterAt.replace(/^\s+/, "");
    if (trimmedAfter === "") continue;
    const firstNonSpace = atEnd + (afterAt.length - trimmedAfter.length);
    if (overlaps(firstNonSpace, firstNonSpace + 1)) continue;
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
      .replace(/\s+(?:at|on|for|from|to|till|until|in)$/i, "")
      .replace(/^[\s,;:]+|[\s,;:]+$/g, "")
      .trim();
    if (cleaned !== "") {
      location = cleaned;
      spans.push({ start: atStart, end: raw.length });
    }
  }

  let title = "";
  const sortedSpans = [...spans].sort((a, b) => a.start - b.start);
  let cursor = 0;
  const appendSegment = (segment: string, followedBySpan: boolean) => {
    let cleaned = segment.replace(/\s+/g, " ").trim();
    cleaned = cleaned.replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "").trim();
    if (cleaned === "") return;
    if (/^(?:to|at|on|for|from|until|till|between)$/i.test(cleaned)) return;
    if (followedBySpan) {
      cleaned = cleaned
        .replace(/\s+(?:at|on|from|until|till|between)$/i, "")
        .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "")
        .trim();
      if (cleaned === "") return;
    }
    title = title === "" ? cleaned : `${title} ${cleaned}`;
  };

  for (const span of sortedSpans) {
    if (span.start < cursor) continue;
    appendSegment(raw.slice(cursor, span.start), true);
    cursor = Math.max(cursor, span.end);
  }
  appendSegment(raw.slice(cursor), false);
  title = title
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "")
    .trim();
  if (title === "") {
    title = raw.trim();
  }

  const hasExplicitDate = dateMatches.length === 1;
  const hasExplicitTime = timeRanges.length === 1;
  const hasExplicitDuration = durationMinutes !== null;

  if (errors.length > 0) {
    return {
      event: null,
      error: errors[0],
      hasExplicitDate,
      hasExplicitTime,
      hasExplicitDuration,
      isValid: false,
    };
  }

  const primaryRange = timeRanges[0] ?? null;
  const startTime = primaryRange?.start ?? DEFAULT_START;
  const dateChoice: DateValue = dateMatches[0] ?? { kind: "tomorrow" };
  const resolvedDay = resolveDateValue(dateChoice, referenceNow, startTime);
  if (resolvedDay.error !== null || resolvedDay.date === null) {
    return {
      event: null,
      error: resolvedDay.error ?? "Invalid date",
      hasExplicitDate,
      hasExplicitTime,
      hasExplicitDuration,
      isValid: false,
    };
  }

  const day = resolvedDay.date;
  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    startTime.hour,
    startTime.minute,
    0,
    0,
  );

  let end: Date;
  if (primaryRange?.end != null) {
    const second = primaryRange.end;
    end = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      second.hour,
      second.minute,
      0,
      0,
    );
    if (end <= start) {
      end = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate() + 1,
        second.hour,
        second.minute,
        0,
        0,
      );
    }
  } else {
    end = new Date(start.getTime() + (durationMinutes ?? 60) * 60_000);
  }

  return {
    event: { title, start, end, location, details: null },
    error: null,
    hasExplicitDate,
    hasExplicitTime,
    hasExplicitDuration,
    isValid: true,
  };
}

export function parseEventText(
  raw: string,
  referenceNow: Date = new Date(),
): ParsedEvent {
  const result = parseCalendarInput(raw, referenceNow);
  if (result.event !== null) {
    return result.event;
  }
  throw new Error(result.error ?? "Invalid calendar event input");
}
