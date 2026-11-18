import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — required because the button renders an icon only. */
  label: string;
  /** sm = compact (title bar, control rows); md = default. */
  size?: "sm" | "md";
}

/**
 * Round, ghost-style icon button. Sits on any surface: transparent at rest,
 * raised on hover, slightly dimmer while pressed.
 */
export function IconButton({
  label,
  size = "md",
  className = "",
  type,
  ...rest
}: IconButtonProps) {
  const dims = size === "sm" ? "size-7" : "size-8";

  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={`inline-flex ${dims} cursor-pointer items-center justify-center rounded-full text-ink-secondary outline-none transition-colors duration-150 ease-out-quart hover:bg-raised hover:text-ink focus-visible:ring-1 focus-visible:ring-hairline-strong active:bg-raised/80 disabled:pointer-events-none disabled:opacity-40 ${className}`}
      {...rest}
    />
  );
}
