import { motion } from "framer-motion";
import { ClipboardList, Pin, StickyNote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUiStore } from "../../stores/ui";
import type { TabId } from "../../types";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

const TABS: readonly TabDef[] = [
  { id: "clipboard", label: "Clipboard", icon: ClipboardList },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "snippets", label: "Snippets", icon: Pin },
];

/**
 * iOS-style segmented control. The active pill slides between tabs via a
 * shared layout animation (transform-only, GPU friendly).
 */
export function SegmentedTabs() {
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);

  return (
    <nav className="shrink-0" aria-label="Sections">
      <div
        role="tablist"
        className="flex gap-1 rounded-full border border-hairline bg-elevated p-1"
      >
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-1 cursor-pointer items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-150 ease-out-quart focus-visible:ring-1 focus-visible:ring-hairline-strong ${
                active ? "text-ink" : "text-ink-muted hover:text-ink-secondary"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="segmented-active-pill"
                  className="absolute inset-0 rounded-full bg-raised"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <Icon size={13} strokeWidth={1.75} />
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
