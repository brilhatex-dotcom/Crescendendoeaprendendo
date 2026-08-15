"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { atualizarConfiguracaoAction } from "./actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button } from "@/design-system/primitives";

/**
 * Uma configuração de acessibilidade, ligada ou desligada de próprio punho —
 * "Configurar manualmente", sem depender de nenhuma sugestão. O mesmo botão
 * também é o "desativar" de qualquer coisa que uma sugestão tenha ligado.
 */
export function ConfiguracaoToggle({
  learnerId,
  campo,
  rotulo,
  descricao,
  ligado,
}: {
  readonly learnerId: string;
  readonly campo: string;
  readonly rotulo: string;
  readonly descricao: string;
  readonly ligado: boolean;
}) {
  const [estado, acao] = useActionState(atualizarConfiguracaoAction, ESTADO_INICIAL);
  const router = useRouter();

  useEffect(() => {
    if (estado.status !== "sucesso") return;
    router.refresh();
  }, [estado, router]);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-4 last:border-0">
      <div className="min-w-0">
        <p className="font-semibold text-slate-100">{rotulo}</p>
        <p className="text-sm text-slate-400">{descricao}</p>
        {estado.status === "erro" ? (
          <Alert tom="erro" className="mt-2">
            {estado.mensagem}
          </Alert>
        ) : null}
      </div>
      <form action={acao}>
        <input type="hidden" name="learnerId" value={learnerId} />
        <input type="hidden" name="campo" value={campo} />
        <input type="hidden" name="valor" value={(!ligado).toString()} />
        <BotaoDeToggle ligado={ligado} />
      </form>
    </li>
  );
}

function BotaoDeToggle({ ligado }: { readonly ligado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variante={ligado ? "primario" : "secundario"}
      disabled={pending}
      aria-pressed={ligado}
    >
      {pending ? "Salvando…" : ligado ? "Ligado" : "Desligado"}
    </Button>
  );
}
