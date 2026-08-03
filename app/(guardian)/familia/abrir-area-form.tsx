"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { abrirAreaInfantilAction } from "@/modules/identity/presentation/actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button } from "@/design-system/primitives";

/**
 * Abre a área infantil para uma criança da família.
 *
 * A navegação acontece depois que a action responde, porque é ela que grava o
 * cookie da sub-sessão — entrar em `/hub` antes disso cairia direto no
 * redirecionamento de volta.
 */
export function AbrirAreaForm({
  learnerId,
  displayName,
}: {
  learnerId: string;
  displayName: string;
}) {
  const [estado, acao] = useActionState(abrirAreaInfantilAction, ESTADO_INICIAL);
  const router = useRouter();

  useEffect(() => {
    if (estado.status !== "sucesso") return;
    router.refresh();
    router.push("/hub");
  }, [estado, router]);

  return (
    <form action={acao}>
      <input type="hidden" name="learnerId" value={learnerId} />

      {estado.status === "erro" ? (
        <Alert tom="erro" className="mb-3">
          {estado.mensagem}
        </Alert>
      ) : null}

      <BotaoDeEnvio displayName={displayName} sucesso={estado.status === "sucesso"} />
    </form>
  );
}

function BotaoDeEnvio({
  displayName,
  sucesso,
}: {
  displayName: string;
  sucesso: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || sucesso}>
      {pending || sucesso ? "Abrindo…" : `Entrar como ${displayName}`}
    </Button>
  );
}
