import { AnimatePresence, motion } from "framer-motion";
import type { ComponentType } from "react";
import { ClipboardPanel } from "./components/Clipboard/ClipboardPanel";
import { MusicCard } from "./components/MusicPlayer/MusicCard";
import { SegmentedTabs } from "./components/common/SegmentedTabs";
import { TitleBar } from "./components/common/TitleBar";
import { NotesPanel } from "./components/Notes/NotesPanel";
import { SnippetsPanel } from "./components/Snippets/SnippetsPanel";
import { useUiStore } from "./stores/ui";
import type { TabId } from "./types";

const TAB_PANELS: Record<TabId, ComponentType> = {
  clipboard: ClipboardPanel,
  notes: NotesPanel,
  snippets: SnippetsPanel,
};

/**
 * Compact floating panel: fixed header + persistent music card, then the
 * active section below. Only the section content swaps on tab change.
 */
export default function App() {
  const activeTab = useUiStore((s) => s.activeTab);
  const ActivePanel = TAB_PANELS[activeTab];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TitleBar />
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
        <MusicCard />
        <SegmentedTabs />
        <div className="min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              className="h-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              // Transform + opacity only — keeps tab transitions on the GPU.
              transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            >
              <ActivePanel />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
