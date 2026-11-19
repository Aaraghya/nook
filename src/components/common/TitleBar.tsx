import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Pocket as PocketGlyph, X } from "lucide-react";
import { IconButton } from "./IconButton";

const appWindow = getCurrentWindow();

/**
 * Custom frameless title bar. Doubles as the window drag region; the close
 * button closes the app for now — minimise-to-tray replaces it in
 * Milestone 2 when the tray icon lands.
 */
export function TitleBar() {
  return (
    <header
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center justify-between pl-4"
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-md border border-hairline bg-elevated text-ink-secondary">
          <PocketGlyph size={12} strokeWidth={2} />
        </span>
        <span
          data-tauri-drag-region
          className="text-[13px] font-semibold tracking-wide"
        >
          Pocket
        </span>
      </div>

      <div className="flex items-center gap-1 pr-2">
        <IconButton
          label="Minimize"
          size="sm"
          onClick={() => void appWindow.hide()}
        >
          <Minus size={14} strokeWidth={1.75} />
        </IconButton>
        <IconButton
          label="Close"
          size="sm"
          className="hover:bg-danger/15 hover:text-danger"
          onClick={() => void appWindow.close()}
        >
          <X size={14} strokeWidth={1.75} />
        </IconButton>
      </div>
    </header>
  );
}
