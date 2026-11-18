import { Pin } from "lucide-react";
import { EmptyState } from "../common/EmptyState";

/** Pinned snippets section (storage lands in Milestone 5). */
export function SnippetsPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold">Snippets</h2>
        <span className="text-[11px] text-ink-muted">Pinned</span>
      </header>
      <EmptyState
        icon={Pin}
        title="No snippets yet"
        hint="Save the bits you type over and over for one-click reuse."
      />
    </div>
  );
}
