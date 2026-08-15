"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { responderRecomendacaoAction } from "./actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button, Card } from "@/design-system/primitives";

/**
 * Uma sugestão de acessibilidade, pronta para o responsável aceitar ou
 * recusar.
 *
 * O texto (`reason`) já vem pronto do Learning Profile — fala de padrão
 * observado, nunca de causa, e nunca de diagnóstico (docs/HANDOFF.md, Fase
 * 3b). Este componente só decide o que fazer com a resposta.
 */
export function RecomendacaoCard({
  learnerId,
  recommendationId,
  reason,
}: {
  readonly learnerId: string;
  readonly recommendationId: string;
  readonly reason: string;
}) {
  const [estado, acao] = useActionState(responderRecomendacaoAction, ESTADO_INICIAL);
  const router = useRouter();

  useEffect(() => {
    if (estado.status !== "sucesso") return;
    router.refresh();
  }, [estado, router]);

  if (estado.status === "sucesso") {
    return (
      <Card>
        <Alert tom="sucesso">
          {estado.dados.aceita
            ? "Ativado. O efeito aparece nas próximas atividades."
            : "Tudo bem — não vamos ativar isso agora."}
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-slate-200">{reason}</p>
      {estado.status === "erro" ? <Alert tom="erro">{estado.mensagem}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        <form action={acao}>
          <input type="hidden" name="learnerId" value={learnerId} />
          <input type="hidden" name="recommendationId" value={recommendationId} />
          <input type="hidden" name="resposta" value="aceitar" />
          <BotaoDeResposta rotulo="Ativar" />
        </form>
        <form action={acao}>
          <input type="hidden" name="learnerId" value={learnerId} />
          <input type="hidden" name="recommendationId" value={recommendationId} />
          <input type="hidden" name="resposta" value="recusar" />
          <BotaoDeResposta rotulo="Agora não" variante="secundario" />
        </form>
      </div>
    </Card>
  );
}

function BotaoDeResposta({
  rotulo,
  variante = "primario",
}: {
  readonly rotulo: string;
  readonly variante?: "primario" | "secundario";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variante={variante} disabled={pending}>
      {pending ? "Um instante…" : rotulo}
    </Button>
  );
}
