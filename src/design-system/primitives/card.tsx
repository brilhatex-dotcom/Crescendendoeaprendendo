import type { ComponentProps } from "react";

import { cn } from "../utils/cn";

export type CardProps = ComponentProps<"div">;

/** Superfície elevada padrão. Sem sombra dramática: o conteúdo é o que pesa. */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--color-play-raised)] p-6",
        className,
      )}
      {...props}
    />
  );
}
