"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { criarPerfilAction } from "@/modules/identity/presentation/actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button, Field } from "@/design-system/primitives";

/**
 * Criação do perfil da criança.
 *
 * Dois campos e só. Não pedimos nome completo, nem data completa de
 * nascimento, nem foto — o ano basta para escolher a faixa etária, e cada dado
 * a mais sobre uma criança é um dado a mais para proteger (PSI4).
 */
export function CriarPerfilForm({ anoAtual }: { anoAtual: number }) {
  const [estado, acao] = useActionState(criarPerfilAction, ESTADO_INICIAL);
  const campos = estado.status === "erro" ? estado.campos : undefined;

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      {estado.status === "erro" && !campos ? (
        <Alert tom="erro">{estado.mensagem}</Alert>
      ) : null}

      {estado.status === "sucesso" ? (
        <Alert tom="sucesso">
          Perfil de <strong>{estado.dados.displayName}</strong> criado.
        </Alert>
      ) : null}

      <Field
        id="displayName"
        name="displayName"
        rotulo="Como a criança quer ser chamada"
        required
        erro={campos?.displayName}
        dica="Um apelido basta. Não pedimos o nome completo."
      />

      <Field
        id="birthYear"
        name="birthYear"
        type="number"
        inputMode="numeric"
        min={anoAtual - 17}
        max={anoAtual - 6}
        rotulo="Ano de nascimento"
        required
        erro={campos?.birthYear}
        dica="Só o ano — é o que usamos para escolher o conteúdo certo."
      />

      <Field
        id="relation"
        name="relation"
        rotulo="Quem você é para a criança"
        required
        erro={campos?.relation}
        dica="Mãe, pai, avó, responsável…"
      />

      <BotaoDeEnvio />
    </form>
  );
}

function BotaoDeEnvio() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" largura="cheia" disabled={pending}>
      {pending ? "Criando perfil…" : "Criar perfil"}
    </Button>
  );
}
