import { invoke } from "@tauri-apps/api/core";
import type { Note } from "../types";

interface NotePayload {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

function toNote(payload: NotePayload): Note {
  return {
    id: payload.id,
    title: payload.title,
    body: payload.body,
    pinned: payload.pinned,
    createdAt: new Date(payload.createdAtMs).toISOString(),
    updatedAt: new Date(payload.updatedAtMs).toISOString(),
  };
}

export function fetchNotes(): Promise<Note[]> {
  return invoke<NotePayload[]>("notes_list").then((notes) =>
    notes.map(toNote),
  );
}

export function createNote(): Promise<Note> {
  return invoke<NotePayload>("notes_create").then(toNote);
}

export function saveNote(id: string, title: string, body: string): Promise<Note> {
  return invoke<NotePayload>("notes_update", { id, title, body }).then(toNote);
}

export function toggleNotePin(id: string): Promise<Note> {
  return invoke<NotePayload>("notes_toggle_pin", { id }).then(toNote);
}

export function deleteNote(id: string): Promise<void> {
  return invoke("notes_delete", { id });
}
