import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { clearClipboardEntries } from "../../services/clipboard";
import { clearSnippets } from "../../services/snippets";
import { useClipboardStore } from "../../stores/clipboard";
import { useSnippetsStore } from "../../stores/snippets";

const ARM_MS = 3000;

export function ClearAllButton() {
  const [armed, setArmed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const timer = useRef<number | null>(null);
  const clearClipboard = useClipboardStore((s) => s.clear);
  const clearSnippetsStore = useSnippetsStore((s) => s.clear);

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
    Promise.all([clearClipboardEntries(), clearSnippets()])
      .then(() => {
        clearClipboard();
        clearSnippetsStore();
      })
      .catch(() => {})
      .finally(() => setClearing(false));
  }, [armed, disarm, clearClipboard, clearSnippetsStore]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={clearing}
      aria-label={armed ? "Confirm clear all entries" : "Clear all entries"}
      title="Clear all ClipStack and Snippets entries"
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
