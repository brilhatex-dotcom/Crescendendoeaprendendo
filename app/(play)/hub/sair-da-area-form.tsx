"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { sairDaAreaInfantilAction } from "@/modules/identity/presentation/actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button, Field } from "@/design-system/primitives";

/**
 * Porta de saída da área infantil — protegida por PIN (ADR 0003).
 *
 * O PIN fica escondido atrás de um clique de propósito: um campo de PIN sempre
 * visível na tela da criança é um convite a tentar adivinhá-lo, e uma tela
 * infantil não deve exibir permanentemente um controle que não é dela.
 */
export function SairDaAreaForm() {
  const [estado, acao] = useActionState(sairDaAreaInfantilAction, ESTADO_INICIAL);
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (estado.status !== "sucesso") return;
    router.refresh();
    router.replace("/familia");
  }, [estado, router]);

  if (!aberto) {
    return (
      <Button variante="secundario" onClick={() => setAberto(true)}>
        Chamar um adulto
      </Button>
    );
  }

  return (
    <form action={acao} className="flex w-full max-w-xs flex-col gap-4" noValidate>
      {estado.status === "erro" ? <Alert tom="erro">{estado.mensagem}</Alert> : null}

      <Field
        id="pin"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        rotulo="PIN do responsável"
        required
        autoFocus
      />

      <div className="flex gap-3">
        <BotaoDeEnvio />
        <Button variante="fantasma" onClick={() => setAberto(false)}>
          Voltar
        </Button>
      </div>
    </form>
  );
}

function BotaoDeEnvio() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Conferindo…" : "Sair"}
    </Button>
  );
}
