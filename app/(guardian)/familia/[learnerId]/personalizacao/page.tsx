import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { identityDeps } from "@/composition/identity";
import { learningProfileGuardianDeps } from "@/composition/learning-profile";
import { obterConfiguracoesDoAprendiz, resolverSessao } from "@/modules/identity";
import { lerTokenDeSessao } from "@/server/session";
import { Alert, Card } from "@/design-system/primitives";

import { CONFIGURACOES } from "./configuracoes";
import { ConfiguracaoToggle } from "./configuracao-toggle";
import { RecomendacaoCard } from "./recomendacao-card";

export const metadata: Metadata = {
  title: "Personalização da aprendizagem — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

/** Depende de sessão, banco e da criança do parâmetro: nunca estática. */
export const dynamic = "force-dynamic";

export default async function PersonalizacaoDaAprendizagemPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const { learnerId } = await params;

  const deps = identityDeps();
  const ator = await resolverSessao(deps, await lerTokenDeSessao());
  if (!ator) redirect("/entrar");
  if (!ator.account.isEmailVerified) redirect("/familia");

  const configuracoes = await obterConfiguracoesDoAprendiz(deps, ator, learnerId);
  if (!configuracoes.ok) redirect("/familia");

  const recomendacoes = await learningProfileGuardianDeps().listarRecomendacoesPendentes(
    learnerId,
  );

  return (
    <div className="flex flex-col gap-12">
      <section>
        <p className="text-sm text-slate-400">
          <Link href="/familia" className="underline underline-offset-4">
            Minha família
          </Link>
          {" → "}Personalização da aprendizagem
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold">
          Personalização da aprendizagem
        </h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Esta plataforma observa como esta criança aprende melhor e, com o tempo, ajusta como as
          atividades são apresentadas. Nada aqui é um diagnóstico — são só padrões observados no
          jeito de jogar. Você decide o que fica ligado.
        </p>
      </section>

      {recomendacoes.length > 0 ? (
        <section aria-labelledby="sugestoes">
          <h2 id="sugestoes" className="font-display text-2xl font-bold">
            Sugestões
          </h2>
          <ul className="mt-6 flex flex-col gap-4">
            {recomendacoes.map((recomendacao) => (
              <li key={recomendacao.id}>
                <RecomendacaoCard
                  learnerId={learnerId}
                  recommendationId={recomendacao.id}
                  reason={recomendacao.reason}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Alert tom="informacao">
          Nenhuma sugestão nova agora. Conforme a criança joga, novas sugestões podem aparecer
          aqui.
        </Alert>
      )}

      <section aria-labelledby="manual">
        <h2 id="manual" className="font-display text-2xl font-bold">
          Configurar manualmente
        </h2>
        <p className="mt-3 text-slate-300">
          Ligue ou desligue qualquer configuração diretamente — inclusive para desfazer algo que
          uma sugestão ativou.
        </p>
        <Card className="mt-6">
          <ul className="flex flex-col">
            {CONFIGURACOES.map(({ campo, rotulo, descricao }) => (
              <ConfiguracaoToggle
                key={campo}
                learnerId={learnerId}
                campo={campo}
                rotulo={rotulo}
                descricao={descricao}
                ligado={Boolean(configuracoes.value[campo])}
              />
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
