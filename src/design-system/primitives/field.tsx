import type { ComponentProps, ReactNode } from "react";

import { cn } from "../utils/cn";

/**
 * Campo de formulário: rótulo, input, dica e erro — em um componente só.
 *
 * Estão juntos de propósito. Rótulo e input separados é como `htmlFor` acaba
 * apontando para nada, e mensagem de erro solta é como ela deixa de ser
 * anunciada por leitor de tela. Aqui, `aria-describedby` e `aria-invalid` não
 * dependem de ninguém lembrar deles.
 */

export interface FieldProps extends Omit<ComponentProps<"input">, "id"> {
  readonly id: string;
  readonly rotulo: string;
  readonly dica?: ReactNode;
  readonly erro?: string;
}

export function Field({
  id,
  rotulo,
  dica,
  erro,
  className,
  required,
  ...props
}: FieldProps) {
  const idDaDica = dica ? `${id}-dica` : undefined;
  const idDoErro = erro ? `${id}-erro` : undefined;
  const descrito = [idDoErro, idDaDica].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-display text-sm font-bold text-slate-200">
        {rotulo}
        {required ? (
          <span className="ml-1 text-[var(--color-corrente)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <input
        id={id}
        required={required}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descrito}
        className={cn(
          "min-h-[var(--touch-target-adult)] rounded-[var(--radius-md)] border bg-white/5 px-4 py-3",
          "text-white placeholder:text-slate-500",
          "transition-colors duration-[var(--duration-quick)]",
          // Erro em coral. Vermelho não existe neste produto (Bíblia Cap. 11 §11.2).
          erro
            ? "border-[var(--color-quase)]"
            : "border-[var(--glass-border)] hover:border-white/25",
          className,
        )}
        {...props}
      />

      {dica ? (
        <p id={idDaDica} className="text-sm text-slate-400">
          {dica}
        </p>
      ) : null}

      {erro ? (
        /*
         * `role="alert"` faz o leitor de tela anunciar a mensagem assim que ela
         * aparece — sem isso, quem não vê a tela só descobre o erro ao tabular
         * de volta pelo formulário inteiro.
         */
        <p
          id={idDoErro}
          role="alert"
          className="text-sm font-semibold text-[var(--color-quase)]"
        >
          {erro}
        </p>
      ) : null}
    </div>
  );
}
