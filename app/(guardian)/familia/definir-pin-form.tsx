"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { definirPinAction } from "@/modules/identity/presentation/actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button, Field } from "@/design-system/primitives";

/**
 * PIN do responsável — o cadeado da porta de saída da área infantil (ADR 0003).
 *
 * O texto explica para que ele serve, porque um PIN sem propósito declarado é
 * um PIN que o adulto escolhe como "1234" e anota no verso do tablet.
 */
export function DefinirPinForm({ jaTemPin }: { jaTemPin: boolean }) {
  const [estado, acao] = useActionState(definirPinAction, ESTADO_INICIAL);
  const campos = estado.status === "erro" ? estado.campos : undefined;

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      {estado.status === "erro" && !campos ? (
        <Alert tom="erro">{estado.mensagem}</Alert>
      ) : null}

      {estado.status === "sucesso" ? (
        <Alert tom="sucesso">PIN salvo.</Alert>
      ) : null}

      <Field
        id="pin"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        rotulo={jaTemPin ? "Novo PIN" : "PIN de 4 a 6 dígitos"}
        required
        erro={campos?.pin}
        dica="Evite 1234, 0000 e a data de nascimento de alguém da casa — são os primeiros palpites de uma criança."
      />

      <Field
        id="confirmacao"
        name="confirmacao"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        rotulo="Repita o PIN"
        required
      />

      <BotaoDeEnvio jaTemPin={jaTemPin} />
    </form>
  );
}

function BotaoDeEnvio({ jaTemPin }: { jaTemPin: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" largura="cheia" disabled={pending}>
      {pending ? "Salvando…" : jaTemPin ? "Trocar PIN" : "Definir PIN"}
    </Button>
  );
}
