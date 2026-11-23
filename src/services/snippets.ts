import { invoke } from "@tauri-apps/api/core";
import type { Snippet } from "../types";

interface SnippetPayload {
  id: string;
  label: string;
  content: string;
  category: string;
  createdAtMs: number;
  updatedAtMs: number;
}

function toSnippet(payload: SnippetPayload): Snippet {
  return {
    id: payload.id,
    label: payload.label,
    content: payload.content,
    category: payload.category,
    createdAt: new Date(payload.createdAtMs).toISOString(),
    updatedAt: new Date(payload.updatedAtMs).toISOString(),
  };
}

export function fetchSnippets(): Promise<Snippet[]> {
  return invoke<SnippetPayload[]>("snippets_list").then((snippets) =>
    snippets.map(toSnippet),
  );
}

export function createSnippet(
  label: string,
  content: string,
  category: string,
): Promise<Snippet> {
  return invoke<SnippetPayload>("snippets_create", {
    label,
    content,
    category,
  }).then(toSnippet);
}

export function saveSnippet(
  id: string,
  label: string,
  content: string,
  category: string,
): Promise<Snippet> {
  return invoke<SnippetPayload>("snippets_update", {
    id,
    label,
    content,
    category,
  }).then(toSnippet);
}

export function copySnippet(id: string): Promise<void> {
  return invoke("snippets_copy", { id });
}

export function deleteSnippet(id: string): Promise<void> {
  return invoke("snippets_delete", { id });
}
