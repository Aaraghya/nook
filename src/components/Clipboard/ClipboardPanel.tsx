import { ClipboardList } from "lucide-react";
import { EmptyState } from "../common/EmptyState";

/** "ClipStack" — clipboard history section (history lands in Milestone 4). */
export function ClipboardPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold">Clipboard</h2>
        <span className="text-[11px] text-ink-muted">ClipStack</span>
      </header>
      <EmptyState
        icon={ClipboardList}
        title="No clips yet"
        hint="Copy anything and it will land here, ready to paste again."
      />
    </div>
  );
}
