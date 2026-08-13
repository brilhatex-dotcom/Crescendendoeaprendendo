"use client";

import { useEffect, useState, useTransition } from "react";

import {
  APRESENTACAO_PADRAO,
  atividadeEm,
  indiceAbsoluto,
  primeiraPosicao,
  proximaPosicao,
  totalDeAtividades,
  type ApresentacaoDeFeedback,
  type EvaluationResult,
  type MissaoNaSessao,
  type PosicaoNaMissao,
  type Premio,
} from "@/activities";
import { obterRenderer } from "@/activities/renderers";
import { FeedbackVisual } from "@/activities/renderers/feedback-visual";
import { cn } from "@/design-system/utils/cn";

import { abrirMissaoAction, concluirMissaoAction, responderAtividadeAction } from "./actions";

/**
 * EXECUTOR DE MISSÃO.
 *
 * Repare no que este componente **não** sabe: o que é múltipla escolha, o que é
 * ordenação, como se corrige qualquer coisa. Ele conhece o formato de uma
 * atividade e o formato de uma devolutiva. É por isso que o 30º tipo não vai
 * exigir uma linha aqui.
 */
export function MissaoRunner({ missao }: { missao: MissaoNaSessao }) {
  /**
   * A missão que a tela usa para navegar. Começa como a `missao` que a página
   * carregou, e é trocada pela versão que `abrirMissaoAction` relê depois de
   * abrir a jogada (`comecar`, abaixo).
   *
   * Isso importa quando há slot dinâmico (docs/08 §7): a lista de atividades
   * que a página monta antes do clique pode não ter todas ainda — a Fila de
   * Revisão, por exemplo, começa sem nenhuma. Sem trocar de missão aqui, o
   * índice que o servidor manda em `retomarNoIndice` apontaria para uma
   * atividade que este componente nunca viu.
   */
  const [missaoAtual, setMissaoAtual] = useState(missao);
  /**
   * A jogada em curso. `null` até a criança tocar em "Começar".
   *
   * É o que amarra cada tentativa a um `QuestRun` — e é por isso que a missão
   * tem uma tela de abertura em vez de começar sozinha: abrir custa Fôlego, e o
   * Next pré-carrega links. Sem o toque explícito, olhar o mapa cobraria por
   * missões que ela nunca jogou.
   */
  const [jogada, setJogada] = useState<{ id: string; retomada: boolean } | null>(null);
  const [posicao, setPosicao] = useState<PosicaoNaMissao>(primeiraPosicao);
  const [resultado, setResultado] = useState<EvaluationResult | undefined>();
  const [premio, setPremio] = useState<Premio | null>(null);
  /** Momento de domínio: a criança acabou de provar que sabe a competência. */
  const [dominou, setDominou] = useState(false);
  const [apresentacao, setApresentacao] = useState<ApresentacaoDeFeedback>(
    APRESENTACAO_PADRAO.CELEBRA,
  );
  const [segurando, setSegurando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(1);
  const [terminou, setTerminou] = useState(false);
  const [premioDaMissao, setPremioDaMissao] = useState<{ xp: number; moedas: number } | null>(
    null,
  );
  const [inicioMs, setInicioMs] = useState(() => Date.now());
  /*
   * Chave de idempotência da tentativa em curso.
   *
   * Nasce junto com a tentativa e só é trocada quando começa outra — é isso que
   * faz o toque duplo, o reenvio depois de uma queda de rede e o sync de uma
   * jogada offline chegarem todos com a mesma chave e serem contados uma vez
   * só. Gerar uma chave nova a cada envio daria o efeito oposto do pretendido.
   */
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [pendente, iniciarTransicao] = useTransition();

  /*
   * `segurarSegundos` mantém os botões travados por alguns instantes depois de
   * uma devolutiva que tem o que ensinar.
   *
   * Parece hostil e é o contrário: sem isso, a criança bate em "tentar de novo"
   * no impulso e nunca lê a explicação — e a explicação é o motivo de a
   * atividade existir. O texto fica visível o tempo todo; o que espera é só o
   * botão.
   */
  useEffect(() => {
    if (!segurando) return;
    const espera = setTimeout(() => setSegurando(false), apresentacao.segurarSegundos * 1000);
    return () => clearTimeout(espera);
  }, [segurando, apresentacao.segurarSegundos]);

  const atividade = atividadeEm(missaoAtual, posicao);
  const total = totalDeAtividades(missaoAtual);
  const numero = indiceAbsoluto(missaoAtual, posicao) + 1;

  /*
   * A abertura vem antes de checar se há atividade. Antes do primeiro
   * "Começar", `missaoAtual` pode não ter a lista completa ainda — de novo, a
   * Fila de Revisão, que só sabe o que preencher depois de `abrirJogada`
   * resolver o slot. Checar `!atividade` primeiro mostraria "missão concluída"
   * para quem nunca começou.
   */
  if (!jogada) {
    return (
      <TelaDeAbertura
        missao={missaoAtual}
        pendente={pendente}
        erro={erro}
        aoComecar={comecar}
      />
    );
  }

  if (terminou || !atividade) {
    return <TelaFinal missao={missaoAtual} premio={premioDaMissao} />;
  }

  const Renderer = obterRenderer(rendererDoTipo(atividade.tipo));

  function comecar(): void {
    setErro(null);
    const dados = new FormData();
    dados.set("missaoSlug", missaoAtual.slug);

    iniciarTransicao(async () => {
      const estado = await abrirMissaoAction({ status: "inicial" }, dados);

      if (estado.status === "sucesso") {
        setMissaoAtual(estado.dados.missao);
        setJogada({ id: estado.dados.questRunId, retomada: estado.dados.retomada });
        // Retomar significa voltar exatamente onde parou. O índice vem do
        // servidor, contado das tentativas gravadas — não de estado do cliente,
        // que não sobrevive a fechar o app. E é contra `estado.dados.missao`
        // que ele precisa bater, não contra a que a tela tinha antes de abrir.
        setPosicao(posicaoDoIndice(estado.dados.missao, estado.dados.retomarNoIndice));
        setInicioMs(Date.now());
      } else if (estado.status === "erro") {
        setErro(estado.mensagem);
      }
    });
  }

  function responder(resposta: unknown): void {
    if (!atividade || !jogada) return;
    setErro(null);

    const dados = new FormData();
    dados.set("missaoSlug", missaoAtual.slug);
    dados.set("atividadeSlug", atividade.slug);
    dados.set("resposta", JSON.stringify(resposta));
    dados.set("tentativa", String(tentativa));
    dados.set("duracaoMs", String(Date.now() - inicioMs));
    dados.set("chaveDeIdempotencia", chave);
    dados.set("questRunId", jogada.id);

    iniciarTransicao(async () => {
      const estado = await responderAtividadeAction({ status: "inicial" }, dados);

      if (estado.status === "sucesso") {
        setResultado(estado.dados.resultado);
        // `premio` já vem nulo numa resposta repetida: nada foi concedido, e
        // mostrar o número de novo seria mentir para ela.
        setPremio(estado.dados.premio);
        setDominou(estado.dados.dominouAgora);
        setApresentacao(estado.dados.apresentacao);
        setSegurando(estado.dados.apresentacao.segurarSegundos > 0);
      } else if (estado.status === "erro") {
        setErro(estado.mensagem);
      }
    });
  }

  function avancar(): void {
    const proxima = proximaPosicao(missaoAtual, posicao);
    limparDevolutiva();
    setTentativa(1);

    if (proxima) {
      setPosicao(proxima);
      return;
    }

    /*
     * Fim da missão. Quem confirma que ela acabou é o servidor, contando as
     * tentativas gravadas — este toque é só o pedido. Se faltar atividade, a
     * ação recusa e a criança vê a mensagem em vez de ganhar o prêmio.
     */
    const corrida = jogada;
    if (!corrida) {
      setTerminou(true);
      return;
    }

    const dados = new FormData();
    dados.set("missaoSlug", missaoAtual.slug);
    dados.set("questRunId", corrida.id);

    iniciarTransicao(async () => {
      const estado = await concluirMissaoAction({ status: "inicial" }, dados);

      if (estado.status === "sucesso" && estado.dados.concedidaAgora) {
        setPremioDaMissao({
          xp: estado.dados.premio.xp,
          moedas: estado.dados.premio.moedas,
        });
      } else if (estado.status === "erro") {
        setErro(estado.mensagem);
      }

      setTerminou(true);
    });
  }

  function tentarDeNovo(): void {
    limparDevolutiva();
    setTentativa((n) => n + 1);
  }

  function limparDevolutiva(): void {
    setResultado(undefined);
    setPremio(null);
    setDominou(false);
    setSegurando(false);
    setInicioMs(Date.now());
    // Começa outra tentativa: chave nova, senão a segunda resposta seria
    // descartada como repetição da primeira.
    setChave(crypto.randomUUID());
  }

  const acertou = resultado?.outcome === "CORRECT";
  const podeAvancar = resultado !== undefined && (acertou || resultado.outcome === "PARTIAL");

  return (
    /*
     * `justify-center` no container, e não `flex-1` no `main`: a atividade e a
     * devolutiva sobem e descem **juntas**. Esticar só o `main` centralizava a
     * atividade e deixava a devolutiva no rodapé — a criança acertava e a
     * celebração aparecia a uma tela de distância do que ela tinha feito.
     */
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span className="font-display uppercase tracking-[0.15em]">{missaoAtual.nome}</span>
          <span>
            {numero} de {total}
          </span>
        </div>

        {/* Progresso com valor acessível: barra sozinha não informa quem não a vê. */}
        {apresentacao.mostrarProgresso ? (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={numero}
            aria-label={`Atividade ${numero} de ${total}`}
            className="h-2 w-full overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-aurora)] to-[var(--color-corrente)] transition-[width] duration-[var(--duration-base)]"
              style={{ width: `${(numero / total) * 100}%` }}
            />
          </div>
        ) : null}
      </header>

      <main>
        {Renderer ? (
          <Renderer
            /*
             * A chave é o que zera o estado interno do renderer.
             *
             * Sem ela, React reaproveita a mesma instância entre atividades do
             * mesmo tipo — e a opção marcada na anterior continuava marcada na
             * seguinte, com "Responder" já aceso. A criança podia enviar, sem
             * ter escolhido nada, um id de opção que nem existe na atividade
             * atual, e levar um "quase" por algo que ela não fez.
             *
             * A tentativa entra na chave pelo mesmo motivo: ao tentar de novo,
             * a escolha anterior não pode continuar marcada.
             */
            key={`${atividade.slug}:${tentativa}`}
            config={atividade.config}
            aoResponder={responder}
            resultado={resultado}
            bloqueado={pendente || resultado !== undefined}
          />
        ) : (
          <p className="text-[var(--color-quase)]">
            Esta atividade ainda não tem tela. Avise um adulto.
          </p>
        )}

        {erro ? (
          <p role="alert" className="mt-6 text-[var(--color-quase)]">
            {erro}
          </p>
        ) : null}
      </main>

      {resultado ? (
        <FeedbackVisual apresentacao={apresentacao}>
          <Devolutiva
            resultado={resultado}
            premio={apresentacao.mostrarPremio ? premio : null}
            dominou={dominou}
            podeAvancar={podeAvancar}
            segurando={segurando}
            aoAvancar={avancar}
            aoTentarDeNovo={tentarDeNovo}
          />
        </FeedbackVisual>
      ) : null}
    </div>
  );
}

function Devolutiva({
  resultado,
  premio,
  dominou,
  podeAvancar,
  segurando,
  aoAvancar,
  aoTentarDeNovo,
}: {
  resultado: EvaluationResult;
  premio: Premio | null;
  dominou: boolean;
  podeAvancar: boolean;
  segurando: boolean;
  aoAvancar: () => void;
  aoTentarDeNovo: () => void;
}) {
  const feedback = resultado.feedback;
  if (!feedback) return null;

  const celebra = feedback.tom === "CELEBRA";

  return (
    <section
      // "status" e não "alert": errar não é emergência, e interromper a leitura
      // da criança com urgência é exatamente o tom que não queremos.
      role="status"
      className={cn(
        "rounded-[var(--radius-lg)] border-2 p-6",
        celebra
          ? "border-[var(--color-folha)] bg-[var(--color-folha)]/10"
          : "border-[var(--color-quase)] bg-[var(--color-quase)]/10",
      )}
    >
      <p
        className={cn(
          "font-display text-xl font-bold",
          celebra ? "text-[var(--color-folha)]" : "text-[var(--color-quase)]",
        )}
      >
        {feedback.mensagem}
      </p>

      {/* O ensino é o motivo de a devolutiva existir. Nunca é escondido. */}
      {"ensino" in feedback ? (
        <p className="mt-3 text-lg text-slate-100">{feedback.ensino}</p>
      ) : null}

      {feedback.dica ? (
        <p className="mt-3 text-slate-300">
          <span className="font-display font-bold">Dica: </span>
          {feedback.dica}
        </p>
      ) : null}

      {premio && premio.xp > 0 ? (
        <p className="font-display mt-4 text-[var(--color-fagulha)]">
          +{premio.xp} de Luz
          {premio.moedas > 0 ? ` · +${premio.moedas} Fagulhas` : ""}
        </p>
      ) : null}

      {/*
        O momento de domínio é raro por construção: exige crença alta, três
        tentativas e dois acertos seguidos no nível de referência (docs/08 §2).
        Justamente por ser raro é que vale marcar — e por isso não se anuncia
        "dominou" a cada acerto.
      */}
      {dominou ? (
        <p className="font-display mt-3 text-[var(--color-corrente)]">
          Você acendeu esta competência. Ela é sua agora.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {podeAvancar ? (
          <BotaoGrande onClick={aoAvancar} desabilitado={segurando}>
            Continuar
          </BotaoGrande>
        ) : (
          <>
            <BotaoGrande onClick={aoTentarDeNovo} desabilitado={segurando}>
              Tentar de novo
            </BotaoGrande>
            {/* Seguir em frente é sempre possível: travar a criança numa
                atividade que ela não consegue é o oposto de ensinar. */}
            <BotaoGrande variante="discreto" onClick={aoAvancar} desabilitado={segurando}>
              Seguir em frente
            </BotaoGrande>
          </>
        )}
      </div>

      {/*
        Quem usa leitor de tela precisa saber por que o botão não responde.
        Botão desabilitado sem explicação é uma parede sem porta.
      */}
      {segurando ? (
        <p className="mt-3 text-sm text-slate-400">Leia com calma — já já você continua.</p>
      ) : null}
    </section>
  );
}

/**
 * A abertura da missão.
 *
 * Existe por duas razões que se somam. A primeira é narrativa: a `introducao`
 * é o que situa a criança no mundo antes de pedir qualquer coisa dela. A
 * segunda é dura — abrir uma missão cobra Fôlego, e o Next pré-carrega links.
 * Sem um toque explícito, olhar o mapa cobraria por missões nunca jogadas.
 */
function TelaDeAbertura({
  missao,
  pendente,
  erro,
  aoComecar,
}: {
  missao: MissaoNaSessao;
  pendente: boolean;
  erro: string | null;
  aoComecar: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]">
        Nova missão
      </p>
      <h1 className="font-display text-3xl font-extrabold text-balance md:text-4xl">
        {missao.nome}
      </h1>
      <p className="max-w-lg text-lg text-slate-300 text-pretty">{missao.introducao}</p>

      <BotaoGrande onClick={aoComecar} desabilitado={pendente}>
        {pendente ? "Abrindo…" : "Começar"}
      </BotaoGrande>

      {erro ? (
        <p role="alert" className="text-[var(--color-quase)]">
          {erro}
        </p>
      ) : null}

      <a href="/hub" className="text-sm text-slate-400 underline">
        Voltar para a base
      </a>
    </div>
  );
}

function TelaFinal({
  missao,
  premio,
}: {
  missao: MissaoNaSessao;
  premio: { xp: number; moedas: number } | null;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]">
        Missão concluída
      </p>
      <h1 className="font-display text-3xl font-extrabold text-balance md:text-4xl">
        {missao.nome}
      </h1>
      <p className="max-w-lg text-lg text-slate-300 text-pretty">{missao.conclusao}</p>

      {/*
        O prêmio da missão só aparece quando foi concedido nesta jogada. Ao
        rejogar, `concedidaAgora` vem falso e nada é mostrado — repetir a
        celebração de algo que não aconteceu ensina que a celebração não vale.
      */}
      {premio && premio.xp > 0 ? (
        <p className="font-display text-xl text-[var(--color-fagulha)]">
          +{premio.xp} de Luz
          {premio.moedas > 0 ? ` · +${premio.moedas} Fagulhas` : ""}
        </p>
      ) : null}

      <a
        href="/hub"
        className="font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)] bg-[var(--color-aurora)] px-8 py-4 text-lg font-bold text-white"
      >
        Voltar para a base
      </a>
    </div>
  );
}

/**
 * Índice absoluto → posição (fase, atividade).
 *
 * O servidor conta atividades numa lista só, porque é assim que elas vivem em
 * `StageActivity`; a tela navega por fase. A conversão precisa existir em algum
 * lugar, e este é o lado que conhece as duas formas.
 */
function posicaoDoIndice(missao: MissaoNaSessao, indice: number): PosicaoNaMissao {
  let restante = indice;

  for (let fase = 0; fase < missao.fases.length; fase += 1) {
    const quantas = missao.fases[fase]?.atividades.length ?? 0;
    if (restante < quantas) return { fase, atividade: restante };
    restante -= quantas;
  }

  // Passou do fim: a missão já estava toda respondida.
  return primeiraPosicao();
}

function BotaoGrande({
  children,
  onClick,
  variante = "principal",
  desabilitado = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variante?: "principal" | "discreto";
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className={cn(
        "font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)] px-8 text-lg font-bold",
        "transition-transform duration-[var(--duration-quick)] hover:scale-[1.02] active:scale-[0.98]",
        "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
        "disabled:pointer-events-none disabled:opacity-50",
        variante === "principal"
          ? "bg-[var(--color-aurora)] text-white"
          : "border border-[var(--glass-border)] text-slate-200",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Mapeia o tipo de atividade para o id do renderer.
 *
 * Vive aqui, e não no plugin, porque o executor é cliente e o plugin é
 * isomórfico — importar o manifesto de plugins aqui arrastaria todos os
 * `evaluate` para o bundle do navegador, que é justo o que o carregamento sob
 * demanda existe para evitar.
 */
function rendererDoTipo(tipo: string): string {
  return tipo.toLowerCase().replace(/_/g, "-");
}
