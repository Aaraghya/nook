import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
}

/** Centered placeholder shown when a module has no content yet. */
export function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-card border border-hairline bg-elevated/40 px-6 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-raised text-ink-muted">
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-medium text-ink-secondary">{title}</p>
      {hint && (
        <p className="max-w-[230px] text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
