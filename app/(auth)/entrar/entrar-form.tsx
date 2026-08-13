"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { entrarAction } from "@/modules/identity/presentation/actions";
import { ESTADO_INICIAL } from "@/shared/forms/action-state";
import { Alert, Button, Field } from "@/design-system/primitives";

export function EntrarForm() {
  const [estado, acao] = useActionState(entrarAction, ESTADO_INICIAL);
  const router = useRouter();

  /*
   * O redirecionamento acontece aqui, e não dentro da action, porque o cookie
   * de sessão precisa estar gravado na resposta antes de qualquer navegação.
   * `router.refresh()` descarta o cache do App Router — sem ele, a próxima
   * página poderia ser servida do cache anterior, ainda sem sessão.
   */
  useEffect(() => {
    if (estado.status !== "sucesso") return;
    router.refresh();
    router.replace(estado.dados.emailVerificado ? "/familia" : "/verificar-email");
  }, [estado, router]);

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
        rotulo="E-mail"
        autoComplete="email"
        required
        erro={campos?.email}
      />

      <Field
        id="senha"
        name="senha"
        type="password"
        rotulo="Senha"
        autoComplete="current-password"
        required
        erro={campos?.senha}
      />

      <Link
        href="/esqueci-a-senha"
        className="-mt-2 self-end text-sm text-slate-400 underline-offset-4 hover:underline"
      >
        Esqueceu sua senha?
      </Link>

      <BotaoDeEnvio sucesso={estado.status === "sucesso"} />

      <p className="text-center text-sm text-slate-400">
        Ainda não tem conta?{" "}
        <Link href="/criar-conta" className="underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </form>
  );
}

function BotaoDeEnvio({ sucesso }: { sucesso: boolean }) {
  const { pending } = useFormStatus();

  // Continua desabilitado depois do sucesso: o redirect está a caminho, e um
  // segundo clique abriria uma sessão a mais sem necessidade.
  return (
    <Button type="submit" largura="cheia" disabled={pending || sucesso}>
      {pending || sucesso ? "Entrando…" : "Entrar"}
    </Button>
  );
}
