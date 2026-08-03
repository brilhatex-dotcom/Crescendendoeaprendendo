"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { reenviarVerificacaoAction } from "@/modules/identity/presentation/actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button, Field } from "@/design-system/primitives";

export function ReenviarForm() {
  const [estado, acao] = useActionState(reenviarVerificacaoAction, ESTADO_INICIAL);

  if (estado.status === "sucesso") {
    return (
      <Alert tom="sucesso" titulo="Link enviado">
        Se existir uma conta pendente para{" "}
        <strong>{estado.dados.emailMascarado}</strong>, o novo link já está a
        caminho. Ele vale por 24 horas e cancela os anteriores.
      </Alert>
    );
  }

  const campos = estado.status === "erro" ? estado.campos : undefined;

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      {estado.status === "erro" && !campos ? (
        <Alert tom="erro">{estado.mensagem}</Alert>
      ) : null}

      <Field
        id="email"
        name="email"
        type="email"
        rotulo="Seu e-mail"
        autoComplete="email"
        required
        erro={campos?.email}
      />

      <BotaoDeEnvio />
    </form>
  );
}

function BotaoDeEnvio() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" largura="cheia" disabled={pending}>
      {pending ? "Enviando…" : "Enviar novo link"}
    </Button>
  );
}
