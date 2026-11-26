import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCalendarInput,
  parseEventText,
  toEventDraft,
  toGCalUtc,
} from "../src/services/calendarParser.ts";

function makeRef(
  year = 2026,
  month = 11,
  day = 25,
  hour = 10,
  minute = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function assertLocalDateTime(
  actual: Date,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  assert.equal(actual.getFullYear(), year);
  assert.equal(actual.getMonth() + 1, month);
  assert.equal(actual.getDate(), day);
  assert.equal(actual.getHours(), hour);
  assert.equal(actual.getMinutes(), minute);
}

test("dates: relative and explicit date phrases", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);

  const cases: Array<[string, number, number, number]> = [
    ["Standup tomorrow", 2026, 11, 26],
    ["Standup today", 2026, 11, 25],
    ["Standup day after tomorrow", 2026, 11, 27],
    ["Standup next monday", 2026, 11, 30],
    ["Standup this friday", 2026, 11, 27],
    ["Standup on 26 november", 2026, 11, 26],
    ["Standup on november 26", 2026, 11, 26],
    ["Standup 26/11/2026", 2026, 11, 26],
    ["Standup 2026-12-01", 2026, 12, 1],
    ["Standup on 3rd of december", 2026, 12, 3],
    ["Standup december 3rd, 2026", 2026, 12, 3],
  ];

  for (const [input, y, m, d] of cases) {
    const parsed = parseEventText(input, ref);
    assert.equal(parsed.title, "Standup", `title failed for "${input}"`);
    assertLocalDateTime(parsed.start, y, m, d, 9, 0);
    assertLocalDateTime(parsed.end, y, m, d, 10, 0);
  }
});

test("date-only inputs keep fallback title and default 9am-10am", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);
  const cases: Array<[string, number, number, number]> = [
    ["tomorrow", 2026, 11, 26],
    ["today", 2026, 11, 25],
    ["day after tomorrow", 2026, 11, 27],
    ["next monday", 2026, 11, 30],
    ["this friday", 2026, 11, 27],
    ["on 26 november", 2026, 11, 26],
    ["on november 26", 2026, 11, 26],
    ["26/11/2026", 2026, 11, 26],
  ];

  for (const [input, y, m, d] of cases) {
    const res = parseCalendarInput(input, ref);
    assert.equal(res.isValid, true, `expected valid for "${input}"`);
    assert.equal(res.hasExplicitDate, true);
    assert.equal(res.hasExplicitTime, false);
    assert.ok(res.event);
    assertLocalDateTime(res.event.start, y, m, d, 9, 0);
    assertLocalDateTime(res.event.end, y, m, d, 10, 0);
  }
});

test("times: single, 24h, named, and range formats", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);

  const cases: Array<[string, number, number, number, number, number]> = [
    ["Sync at 8pm", 20, 0, 21, 0, 26],
    ["Sync at 8:30pm", 20, 30, 21, 30, 26],
    ["Sync at 20:30", 20, 30, 21, 30, 26],
    ["Sync from 9am to 11am", 9, 0, 11, 0, 26],
    ["Sync 9-10pm", 21, 0, 22, 0, 26],
    ["Sync 9am-10am", 9, 0, 10, 0, 26],
    ["Sync between 2pm and 4pm", 14, 0, 16, 0, 26],
    ["Sync at noon", 12, 0, 13, 0, 26],
    ["Sync at midnight", 0, 0, 1, 0, 26],
  ];

  for (const [input, sh, sm, eh, em, endDay] of cases) {
    const parsed = parseEventText(input, ref);
    assert.equal(parsed.title, "Sync", `title failed for "${input}"`);
    assert.equal(parsed.location, null, `location should be null for "${input}"`);
    assertLocalDateTime(parsed.start, 2026, 11, 26, sh, sm);
    assertLocalDateTime(parsed.end, 2026, 11, endDay, eh, em);
  }
});

test("time-only inputs default to tomorrow", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);
  const res = parseCalendarInput("at 8:30pm", ref);
  assert.equal(res.isValid, true);
  assert.equal(res.hasExplicitDate, false);
  assert.equal(res.hasExplicitTime, true);
  assert.ok(res.event);
  assertLocalDateTime(res.event.start, 2026, 11, 26, 20, 30);
  assertLocalDateTime(res.event.end, 2026, 11, 26, 21, 30);
});

test("missing date and time uses tomorrow 9am for 60 minutes", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);
  const res = parseCalendarInput("buy groceries", ref);
  assert.equal(res.isValid, true);
  assert.equal(res.hasExplicitDate, false);
  assert.equal(res.hasExplicitTime, false);
  assert.ok(res.event);
  assert.equal(res.event.title, "buy groceries");
  assertLocalDateTime(res.event.start, 2026, 11, 26, 9, 0);
  assertLocalDateTime(res.event.end, 2026, 11, 26, 10, 0);
});

test("durations: hours, minutes, article, compound", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);

  const cases: Array<[string, number]> = [
    ["Workshop for 2 hours", 120],
    ["Workshop for 30 minutes", 30],
    ["Workshop for an hour", 60],
    ["Workshop for 1 hour 30 minutes", 90],
    ["Workshop for half an hour", 30],
    ["Workshop for 1.5 hours", 90],
  ];

  for (const [input, expectedMinutes] of cases) {
    const parsed = parseEventText(input, ref);
    assert.equal(parsed.title, "Workshop", `title failed for "${input}"`);
    const actualMinutes = Math.round(
      (parsed.end.getTime() - parsed.start.getTime()) / 60_000,
    );
    assert.equal(actualMinutes, expectedMinutes, `duration failed for "${input}"`);
  }
});

test("combined natural-language inputs", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);

  const e1 = parseEventText("lunch with mom tomorrow at 9am", ref);
  assert.equal(e1.title, "lunch with mom");
  assert.equal(e1.location, null);
  assertLocalDateTime(e1.start, 2026, 11, 26, 9, 0);
  assertLocalDateTime(e1.end, 2026, 11, 26, 10, 0);

  const e2 = parseEventText("dinner next friday at 8pm", ref);
  assert.equal(e2.title, "dinner");
  assert.equal(e2.location, null);
  assertLocalDateTime(e2.start, 2026, 12, 4, 20, 0);
  assertLocalDateTime(e2.end, 2026, 12, 4, 21, 0);

  const e3 = parseEventText(
    "meeting with the team on 26 november from 10am to 11:30am",
    ref,
  );
  assert.equal(e3.title, "meeting with the team");
  assert.equal(e3.location, null);
  assertLocalDateTime(e3.start, 2026, 11, 26, 10, 0);
  assertLocalDateTime(e3.end, 2026, 11, 26, 11, 30);

  const e4 = parseEventText(
    "dentist appointment day after tomorrow at 4pm for 30 minutes",
    ref,
  );
  assert.equal(e4.title, "dentist appointment");
  assert.equal(e4.location, null);
  assertLocalDateTime(e4.start, 2026, 11, 27, 16, 0);
  assertLocalDateTime(e4.end, 2026, 11, 27, 16, 30);

  const e5 = parseEventText(
    "project discussion tomorrow at 2pm for 2 hours",
    ref,
  );
  assert.equal(e5.title, "project discussion");
  assert.equal(e5.location, null);
  assertLocalDateTime(e5.start, 2026, 11, 26, 14, 0);
  assertLocalDateTime(e5.end, 2026, 11, 26, 16, 0);

  const e6 = parseEventText("dinner at 8pm at olive garden", ref);
  assert.equal(e6.title, "dinner");
  assert.equal(e6.location, "olive garden");
  assertLocalDateTime(e6.start, 2026, 11, 26, 20, 0);
  assertLocalDateTime(e6.end, 2026, 11, 26, 21, 0);

  const e7 = parseEventText(
    "team meeting next monday from 9am to 10am at the office",
    ref,
  );
  assert.equal(e7.title, "team meeting");
  assert.equal(e7.location, "the office");
  assertLocalDateTime(e7.start, 2026, 11, 30, 9, 0);
  assertLocalDateTime(e7.end, 2026, 11, 30, 10, 0);

  const e8 = parseEventText("coffee with sam tomorrow at noon", ref);
  assert.equal(e8.title, "coffee with sam");
  assert.equal(e8.location, null);
  assertLocalDateTime(e8.start, 2026, 11, 26, 12, 0);
  assertLocalDateTime(e8.end, 2026, 11, 26, 13, 0);
});

test("shared-meridiem ranges and ranges crossing noon/midnight", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);

  const r1 = parseEventText("Study 9-10pm", ref);
  assertLocalDateTime(r1.start, 2026, 11, 26, 21, 0);
  assertLocalDateTime(r1.end, 2026, 11, 26, 22, 0);

  const r2 = parseEventText("Study 9-10am", ref);
  assertLocalDateTime(r2.start, 2026, 11, 26, 9, 0);
  assertLocalDateTime(r2.end, 2026, 11, 26, 10, 0);

  const r3 = parseEventText("Brunch 11-1pm", ref);
  assertLocalDateTime(r3.start, 2026, 11, 26, 11, 0);
  assertLocalDateTime(r3.end, 2026, 11, 26, 13, 0);

  const r4 = parseEventText("Lunch 12-2pm", ref);
  assertLocalDateTime(r4.start, 2026, 11, 26, 12, 0);
  assertLocalDateTime(r4.end, 2026, 11, 26, 14, 0);

  const r5 = parseEventText("Late shift 11pm to 1am", ref);
  assertLocalDateTime(r5.start, 2026, 11, 26, 23, 0);
  assertLocalDateTime(r5.end, 2026, 11, 27, 1, 0);

  const r6 = parseEventText("Night shift 11-1am", ref);
  assertLocalDateTime(r6.start, 2026, 11, 26, 23, 0);
  assertLocalDateTime(r6.end, 2026, 11, 27, 1, 0);
});

test("location extraction handles addresses and multiple at keywords", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);

  const e1 = parseEventText("lunch with mom tomorrow at 2pm at the diner", ref);
  assert.equal(e1.title, "lunch with mom");
  assert.equal(e1.location, "the diner");

  const e2 = parseEventText("meeting at 123 Main St tomorrow at 3pm", ref);
  assert.equal(e2.title, "meeting");
  assert.equal(e2.location, "123 Main St");

  const e3 = parseEventText(
    "dinner at olive garden on 26 november for 2 hours",
    ref,
  );
  assert.equal(e3.title, "dinner");
  assert.equal(e3.location, "olive garden");
});

test("title preservation: ordinary numbers, capitalization, punctuation", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);

  const e1 = parseEventText("CS 101 Lecture tomorrow at 2pm", ref);
  assert.equal(e1.title, "CS 101 Lecture");

  const e2 = parseEventText("Room 402 standup on 26 november at 9am", ref);
  assert.equal(e2.title, "Room 402 standup");

  const e3 = parseEventText("1 on 1 with Alex today at 4pm", ref);
  assert.equal(e3.title, "1 on 1 with Alex");

  const e4 = parseEventText("24/7 on-call handoff tomorrow at 8am", ref);
  assert.equal(e4.title, "24/7 on-call handoff");

  const e5 = parseEventText("  Dentist   Appointment,   TOMORROW   AT  4PM.  ", ref);
  assert.equal(e5.title, "Dentist Appointment");
  assertLocalDateTime(e5.start, 2026, 11, 26, 16, 0);
});

test("year inference rolls past month/day into next year", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);
  const parsed = parseEventText("Doctor checkup on 5 january at 10am", ref);
  assert.equal(parsed.title, "Doctor checkup");
  assertLocalDateTime(parsed.start, 2027, 1, 5, 10, 0);
});

test("existing weekday rollover moves same-day past time to next week", () => {
  const ref = makeRef(2026, 11, 25, 18, 0);
  const parsed = parseEventText("Standup wednesday at 9am", ref);
  assertLocalDateTime(parsed.start, 2026, 12, 2, 9, 0);
});

test("invalid dates, invalid times, and ambiguous multiple expressions report errors", () => {
  const ref = makeRef(2026, 11, 25, 10, 0);

  const invalids = [
    "Meeting on 31/02/2026 at 10am",
    "Meeting on february 30 at 10am",
    "Meeting tomorrow at 25:00",
    "Meeting tomorrow at 13pm",
    "Meeting tomorrow at 0am",
    "Meeting tomorrow at 8:75pm",
    "Meeting tomorrow at 9am for 0 minutes",
    "Meeting today or tomorrow at 9am",
    "Meeting tomorrow at 9am or 11am",
    "Meeting from 9am to 11am for 30 minutes",
  ];

  for (const input of invalids) {
    const res = parseCalendarInput(input, ref);
    assert.equal(res.isValid, false, `expected invalid for "${input}"`);
    assert.equal(res.event, null);
    assert.ok(res.error && res.error.length > 0, `expected error message for "${input}"`);
  }
});

test("timezone conversion produces accurate Google Calendar UTC timestamps", () => {
  const originalTz = process.env.TZ;
  try {
    process.env.TZ = "Asia/Kolkata";
    const refIst = makeRef(2026, 11, 25, 10, 0);
    const parsedIst = parseEventText("meeting tomorrow at 9am", refIst);
    const draftIst = toEventDraft(parsedIst);
    assert.equal(draftIst.startUtc, "20261126T033000Z");
    assert.equal(draftIst.endUtc, "20261126T043000Z");

    process.env.TZ = "America/New_York";
    const refNy = makeRef(2026, 11, 25, 10, 0);
    const parsedNy = parseEventText("meeting tomorrow at 9am", refNy);
    const draftNy = toEventDraft(parsedNy);
    assert.equal(draftNy.startUtc, "20261126T140000Z");
    assert.equal(draftNy.endUtc, "20261126T150000Z");

    process.env.TZ = "UTC";
    const refUtc = makeRef(2026, 11, 25, 10, 0);
    const parsedUtc = parseEventText("meeting tomorrow at 9am", refUtc);
    assert.equal(toGCalUtc(parsedUtc.start), "20261126T090000Z");
  } finally {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  }
});
