"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { pedirRedefinicaoDeSenhaAction } from "@/modules/identity/presentation/actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button, Field } from "@/design-system/primitives";

export function EsqueciASenhaForm() {
  const [estado, acao] = useActionState(pedirRedefinicaoDeSenhaAction, ESTADO_INICIAL);

  if (estado.status === "sucesso") {
    return (
      <Alert tom="sucesso" titulo="Confira sua caixa de entrada">
        Se existir uma conta para <strong>{estado.dados.emailMascarado}</strong>,
        enviamos um link para escolher uma senha nova. Ele vale por 1 hora.
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
      {pending ? "Enviando…" : "Enviar link de redefinição"}
    </Button>
  );
}
