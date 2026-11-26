import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { clearClipboardEntries } from "../../services/clipboard";
import { clearSnippets } from "../../services/snippets";
import { useClipboardStore } from "../../stores/clipboard";
import { useCalendarStore } from "../../stores/calendar";
import { useSnippetsStore } from "../../stores/snippets";
import { useUiStore } from "../../stores/ui";

const ARM_MS = 3000;

export function ClearAllButton() {
  const [armed, setArmed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const timer = useRef<number | null>(null);
  const clearClipboard = useClipboardStore((s) => s.clear);
  const clearCalendar = useCalendarStore((s) => s.clearEntries);
  const clearSnippetsStore = useSnippetsStore((s) => s.clear);
  const activeTab = useUiStore((s) => s.activeTab);
  const clearLabel = activeTab === "clipboard" ? "ClipStack" : activeTab === "snippets" ? "Snippets" : "Calendar";

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const disarm = useCallback(() => {
    setArmed(false);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!armed) {
      setArmed(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setArmed(false);
        timer.current = null;
      }, ARM_MS);
      return;
    }
    disarm();
    setClearing(true);
    const clearActiveCategory = async () => {
      try {
        if (activeTab === "clipboard") {
          await clearClipboardEntries();
          clearClipboard();
        } else if (activeTab === "snippets") {
          await clearSnippets();
          clearSnippetsStore();
        } else {
          clearCalendar();
        }
      } catch {
        return;
      } finally {
        setClearing(false);
      }
    };
    void clearActiveCategory();
  }, [
    activeTab,
    armed,
    clearCalendar,
    clearClipboard,
    clearSnippetsStore,
    disarm,
  ]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={clearing}
      aria-label={
        armed
          ? `Confirm clear all ${clearLabel} entries`
          : `Clear all ${clearLabel} entries`
      }
      title={`Clear all ${clearLabel} entries`}
      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-150 ease-out-quart focus-visible:ring-1 focus-visible:ring-hairline-strong ${
        armed
          ? "border-danger/40 bg-danger/15 text-danger"
          : "border-hairline bg-elevated text-ink-muted hover:text-ink-secondary"
      }`}
    >
      {armed ? (
        <span className="text-[10px] font-semibold">Sure?</span>
      ) : (
        <Trash2 size={14} strokeWidth={1.75} />
      )}
    </button>
  );
}
