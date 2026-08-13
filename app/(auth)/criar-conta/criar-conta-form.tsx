"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { criarContaAction } from "@/modules/identity/presentation/actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button, Field } from "@/design-system/primitives";

/**
 * Formulário de criação de conta do responsável.
 *
 * Client Component porque precisa de `useActionState` para exibir erro por
 * campo sem recarregar a página. A regra de negócio continua inteira no
 * servidor: o que está aqui é apresentação e estado de formulário.
 */
export function CriarContaForm() {
  const [estado, acao] = useActionState(criarContaAction, ESTADO_INICIAL);

  if (estado.status === "sucesso") {
    return (
      <Alert tom="sucesso" titulo="Confira sua caixa de entrada">
        <p>
          Enviamos um link de confirmação para{" "}
          <strong>{estado.dados.emailMascarado}</strong>. Ele vale por 24 horas.
        </p>
        <p className="mt-2">
          Não chegou? Veja também a caixa de spam — ou{" "}
          <Link href="/verificar-email" className="underline underline-offset-4">
            peça um novo link
          </Link>
          .
        </p>
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
        id="nome"
        name="nome"
        rotulo="Seu nome"
        autoComplete="name"
        required
        erro={campos?.nome}
      />

      <Field
        id="email"
        name="email"
        type="email"
        rotulo="Seu e-mail"
        autoComplete="email"
        required
        erro={campos?.email}
        dica="É por aqui que confirmamos sua conta e falamos com você."
      />

      <Field
        id="senha"
        name="senha"
        type="password"
        rotulo="Sua senha"
        autoComplete="new-password"
        required
        erro={campos?.senha}
        dica="Pelo menos 6 caracteres."
      />

      <p className="text-sm text-slate-400">
        Ao criar a conta você concorda em ser o responsável legal pelos perfis de
        criança que criar.{" "}
        <Link href="/para-pais" className="underline underline-offset-4">
          O que fazemos com esses dados.
        </Link>
      </p>

      <BotaoDeEnvio />

      <p className="text-center text-sm text-slate-400">
        Já tem conta?{" "}
        <Link href="/entrar" className="underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}

/**
 * `useFormStatus` só enxerga o formulário acima dele na árvore, então o botão
 * precisa ser um componente separado — dentro de `CriarContaForm` ele leria
 * sempre `pending: false`.
 */
function BotaoDeEnvio() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" largura="cheia" disabled={pending}>
      {pending ? "Criando sua conta…" : "Criar conta"}
    </Button>
  );
}
