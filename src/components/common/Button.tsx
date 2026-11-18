import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: elevated surface with hairline border; ghost: text-only. */
  variant?: "primary" | "ghost";
}

const VARIANTS = {
  primary:
    "rounded-control border border-hairline bg-elevated px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-raised active:bg-raised/80",
  ghost:
    "rounded-control px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-raised hover:text-ink active:bg-raised/80",
} as const;

/** Subtle iOS-style button; keep labels short and lowercase-leaning. */
export function Button({
  variant = "primary",
  className = "",
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 outline-none transition-colors duration-150 ease-out-quart focus-visible:ring-1 focus-visible:ring-hairline-strong disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
