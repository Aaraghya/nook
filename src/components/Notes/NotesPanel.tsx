import { StickyNote } from "lucide-react";
import { EmptyState } from "../common/EmptyState";

/** "Pinboard" — quick notes section (persistence lands in Milestone 5). */
export function NotesPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold">Notes</h2>
        <span className="text-[11px] text-ink-muted">Pinboard</span>
      </header>
      <EmptyState
        icon={StickyNote}
        title="No notes yet"
        hint="Jot down a thought and Pinboard keeps it, auto-saved."
      />
    </div>
  );
}
