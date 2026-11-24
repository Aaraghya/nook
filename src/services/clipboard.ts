import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ClipboardEntry } from "../types";

interface ClipboardEntryPayload {
  id: string;
  content: string;
  capturedAtMs: number;
  pinned: boolean;
}

function toEntry(payload: ClipboardEntryPayload): ClipboardEntry {
  return {
    id: payload.id,
    content: payload.content,
    capturedAt: new Date(payload.capturedAtMs).toISOString(),
    pinned: payload.pinned,
  };
}

export function fetchClipboardEntries(): Promise<ClipboardEntry[]> {
  return invoke<ClipboardEntryPayload[]>("clipboard_get_entries").then(
    (entries) => entries.map(toEntry),
  );
}

export function subscribeClipboardNew(
  handler: (entry: ClipboardEntry) => void,
): Promise<UnlistenFn> {
  return listen<ClipboardEntryPayload>("clipboard:new", (event) =>
    handler(toEntry(event.payload)),
  );
}

export function copyClipboardEntry(id: string): Promise<void> {
  return invoke("clipboard_copy", { id });
}

export function toggleClipboardEntryPin(id: string): Promise<void> {
  return invoke("clipboard_toggle_pin", { id });
}

export function deleteClipboardEntry(id: string): Promise<void> {
  return invoke("clipboard_delete", { id });
}

export function clearClipboardEntries(): Promise<void> {
  return invoke("clipboard_clear");
}
