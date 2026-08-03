import type { ReactNode } from "react";

import { cn } from "../utils/cn";

export type TomDoAlerta = "erro" | "sucesso" | "informacao";

export interface AlertProps {
  readonly tom: TomDoAlerta;
  readonly titulo?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

const TONS: Record<TomDoAlerta, { caixa: string; texto: string }> = {
  /* Coral, jamais vermelho — vale para o adulto também: o tom do produto é o
     mesmo em todas as áreas, e alarme visual não melhora nenhuma decisão. */
  erro: {
    caixa: "border-[var(--color-quase)]/40 bg-[var(--color-quase)]/10",
    texto: "text-[var(--color-quase)]",
  },
  sucesso: {
    caixa: "border-[var(--color-folha)]/40 bg-[var(--color-folha)]/10",
    texto: "text-[var(--color-folha)]",
  },
  informacao: {
    caixa: "border-[var(--color-corrente)]/40 bg-[var(--color-corrente)]/10",
    texto: "text-[var(--color-corrente)]",
  },
};

export function Alert({ tom, titulo, children, className }: AlertProps) {
  const estilo = TONS[tom];

  return (
    <div
      /*
       * "alert" interrompe a leitura em curso; "status" espera uma pausa.
       * Erro justifica interromper — confirmação de sucesso não.
       */
      role={tom === "erro" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] border px-4 py-3 text-sm",
        estilo.caixa,
        className,
      )}
    >
      {titulo ? (
        <p className={cn("font-display font-bold", estilo.texto)}>{titulo}</p>
      ) : null}
      <div className={cn("text-slate-200", titulo ? "mt-1" : "")}>{children}</div>
    </div>
  );
}
