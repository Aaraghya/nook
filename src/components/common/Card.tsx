import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevated surface container — the base unit of Pocket's layout. */
}

/** Elevated surface with hairline border and soft shadow. */
export function Card({ className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-card border border-hairline bg-elevated shadow-card ${className}`}
      {...rest}
    />
  );
}
