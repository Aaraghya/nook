import assert from "node:assert/strict";
import test from "node:test";
import { useCalendarStore } from "../src/stores/calendar.ts";
import { sortClipboardEntries, useClipboardStore } from "../src/stores/clipboard.ts";

test("calendar store isolates multiple entries and handles deletion cleanly", () => {
  const store = useCalendarStore.getState();
  const initialId = store.entries[0].id;

  store.setInput(initialId, "lunch with mom tomorrow at 9am");
  store.previewEntry(initialId);

  const secondId = store.addEntry();
  assert.equal(useCalendarStore.getState().entries.length, 2);
  assert.equal(useCalendarStore.getState().activeId, secondId);

  store.setInput(secondId, "dinner at 8pm at olive garden");

  const stateAfterEdits = useCalendarStore.getState();
  assert.equal(stateAfterEdits.entries[0].input, "lunch with mom tomorrow at 9am");
  assert.equal(stateAfterEdits.entries[0].phase, "preview");
  assert.equal(stateAfterEdits.entries[0].parsed?.title, "lunch with mom");

  assert.equal(stateAfterEdits.entries[1].input, "dinner at 8pm at olive garden");
  assert.equal(stateAfterEdits.entries[1].phase, "edit");
  assert.equal(stateAfterEdits.entries[1].parsed?.location, "olive garden");

  store.selectEntry(initialId);
  assert.equal(useCalendarStore.getState().activeId, initialId);
  assert.equal(useCalendarStore.getState().entries[1].input, "dinner at 8pm at olive garden");

  store.deleteEntry(initialId);
  const afterDeleteActive = useCalendarStore.getState();
  assert.equal(afterDeleteActive.entries.length, 1);
  assert.equal(afterDeleteActive.activeId, secondId);
  assert.equal(afterDeleteActive.entries[0].input, "dinner at 8pm at olive garden");

  store.deleteEntry(secondId);
  const afterDeleteLast = useCalendarStore.getState();
  assert.equal(afterDeleteLast.entries.length, 1);
  assert.equal(afterDeleteLast.entries[0].input, "");
  assert.equal(afterDeleteLast.entries[0].phase, "edit");
});

test("calendar store exposes validation errors on invalid input", () => {
  const store = useCalendarStore.getState();
  const id = store.entries[0].id;
  store.setInput(id, "meeting on 31/02/2026 at 25:00");
  store.previewEntry(id);

  const entry = useCalendarStore.getState().entries[0];
  assert.equal(entry.phase, "preview");
  assert.equal(entry.parsed, null);
  assert.ok(entry.parseError);
});

test("calendar store collapses the active entry without changing its data", () => {
  const store = useCalendarStore.getState();
  const id = store.entries[0].id;

  store.setInput(id, "meeting tomorrow at 9am");
  store.previewEntry(id);
  assert.equal(useCalendarStore.getState().activeId, id);

  store.collapseEntry();
  const collapsed = useCalendarStore.getState();
  assert.equal(collapsed.activeId, null);
  assert.equal(collapsed.entries[0].phase, "preview");
  assert.equal(collapsed.entries[0].input, "meeting tomorrow at 9am");
});

test("calendar store clears all entries and leaves one ready draft", () => {
  const store = useCalendarStore.getState();
  const firstId = store.entries[0].id;
  store.setInput(firstId, "meeting tomorrow at 9am");
  store.previewEntry(firstId);
  store.addEntry();

  store.clearEntries();
  const cleared = useCalendarStore.getState();
  assert.equal(cleared.entries.length, 1);
  assert.equal(cleared.entries[0].input, "");
  assert.equal(cleared.entries[0].phase, "edit");
  assert.equal(cleared.activeId, cleared.entries[0].id);
});

test("clipboard store keeps pinned items at top across new copies, toggles, and search", () => {
  const store = useClipboardStore.getState();
  store.clear();

  store.applyEntries([
    {
      id: "1",
      content: "oldest alpha",
      capturedAt: "2026-11-25T08:00:00.000Z",
      pinned: false,
    },
    {
      id: "2",
      content: "middle beta",
      capturedAt: "2026-11-25T09:00:00.000Z",
      pinned: false,
    },
    {
      id: "3",
      content: "newest gamma",
      capturedAt: "2026-11-25T10:00:00.000Z",
      pinned: false,
    },
  ]);

  store.togglePin("1");
  assert.deepEqual(
    useClipboardStore.getState().entries.map((e) => e.id),
    ["1", "3", "2"],
  );

  store.applyNewEntry({
    id: "4",
    content: "fresh delta",
    capturedAt: "2026-11-25T11:00:00.000Z",
    pinned: false,
  });
  assert.deepEqual(
    useClipboardStore.getState().entries.map((e) => e.id),
    ["1", "4", "3", "2"],
  );

  store.togglePin("2");
  assert.deepEqual(
    useClipboardStore.getState().entries.map((e) => e.id),
    ["2", "1", "4", "3"],
  );

  const filtered = sortClipboardEntries(
    useClipboardStore
      .getState()
      .entries.filter((e) => e.content.includes("a")),
  );
  assert.deepEqual(
    filtered.map((e) => e.id),
    ["2", "1", "4", "3"],
  );

  store.togglePin("2");
  assert.deepEqual(
    useClipboardStore.getState().entries.map((e) => e.id),
    ["1", "4", "3", "2"],
  );
});
