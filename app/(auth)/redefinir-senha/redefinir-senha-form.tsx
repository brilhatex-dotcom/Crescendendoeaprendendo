"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { redefinirSenhaAction } from "@/modules/identity/presentation/actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button, Field, buttonStyles } from "@/design-system/primitives";

export function RedefinirSenhaForm({ token }: { readonly token: string }) {
  const [estado, acao] = useActionState(redefinirSenhaAction, ESTADO_INICIAL);

  if (estado.status === "sucesso") {
    return (
      <Alert tom="sucesso" titulo="Senha alterada">
        <p>Sua senha foi redefinida. Todas as sessões antigas foram encerradas.</p>
        <Link href="/entrar" className={buttonStyles({ className: "mt-4" })}>
          Entrar com a senha nova
        </Link>
      </Alert>
    );
  }

  const campos = estado.status === "erro" ? estado.campos : undefined;

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      {estado.status === "erro" && !campos ? (
        <Alert tom="erro">{estado.mensagem}</Alert>
      ) : null}

      <input type="hidden" name="token" value={token} />

      <Field
        id="senha"
        name="senha"
        type="password"
        rotulo="Senha nova"
        autoComplete="new-password"
        required
        erro={campos?.senha}
        dica="Pelo menos 6 caracteres."
      />

      <Field
        id="confirmacao"
        name="confirmacao"
        type="password"
        rotulo="Confirme a senha nova"
        autoComplete="new-password"
        required
        erro={campos?.confirmacao}
      />

      <BotaoDeEnvio />
    </form>
  );
}

function BotaoDeEnvio() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" largura="cheia" disabled={pending}>
      {pending ? "Salvando…" : "Salvar senha nova"}
    </Button>
  );
}
