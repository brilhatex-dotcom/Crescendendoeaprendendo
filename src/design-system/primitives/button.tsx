import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "../utils/cn";

/**
 * Botão do Design System.
 *
 * A altura mínima não é decoração: `--touch-target-adult` (44px) é o mínimo do
 * WCAG 2.2 para alvo de toque, e `--touch-target-play` (56px) é o tamanho que
 * uma mão de 7 anos acerta sem frustração (docs/05 §6).
 *
 * O componente não conhece domínio — recebe props e nada mais (docs/02 §regras).
 */
/**
 * Exportado para que um `Link` possa ter a aparência de botão.
 *
 * Preferimos isto a um componente `LinkButton` genérico: com `typedRoutes`
 * ligado, o `href` do `Link` do Next é um tipo gerado, e envolvê-lo faria o
 * wrapper perder a checagem de rota inexistente em tempo de compilação.
 * Navegação continua sendo `<a>`; ação continua sendo `<button>`.
 */
export const buttonStyles = cva(
  [
    "font-display inline-flex items-center justify-center gap-2 rounded-[var(--radius-xl)]",
    "font-bold transition-transform duration-[var(--duration-quick)] ease-[var(--ease-aurora)]",
    "hover:scale-[1.02] active:scale-[0.98]",
    // Movimento reduzido: some o deslocamento, nunca o feedback.
    "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-60",
  ],
  {
    variants: {
      variante: {
        primario:
          "bg-[var(--color-aurora)] text-white shadow-[0_8px_24px_-6px_var(--academy-glow)]",
        secundario:
          "border border-[var(--glass-border)] bg-white/5 text-slate-100 hover:bg-white/10",
        fantasma: "text-slate-300 hover:bg-white/5",
      },
      tamanho: {
        adulto: "min-h-[var(--touch-target-adult)] px-6 py-3 text-base",
        infantil: "min-h-[var(--touch-target-play)] px-8 py-4 text-lg",
      },
      largura: {
        auto: "",
        cheia: "w-full",
      },
    },
    defaultVariants: {
      variante: "primario",
      tamanho: "adulto",
      largura: "auto",
    },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonStyles>;

export function Button({
  className,
  variante,
  tamanho,
  largura,
  type = "button",
  ...props
}: ButtonProps) {
  // `type` explícito: o padrão do HTML é "submit", e um botão que envia o
  // formulário sem querer é um bug caro de achar.
  return (
    <button
      type={type}
      className={cn(buttonStyles({ variante, tamanho, largura }), className)}
      {...props}
    />
  );
}
