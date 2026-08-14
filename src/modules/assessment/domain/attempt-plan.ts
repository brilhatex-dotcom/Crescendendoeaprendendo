import {
  PREMIO_VAZIO,
  calcularPremio,
  type AttemptOutcome,
  type EvaluationResult,
  type Premio,
  type RegistroDeTentativa,
  type RegraDeRecompensa,
} from "@/activities";
import type { DomainEvent } from "@/shared/kernel";

import {
  TOPICO_TELEMETRIA_DE_TENTATIVA,
  TOPICO_TENTATIVA_AVALIADA,
  telemetriaDeTentativa,
  tentativaAvaliada,
  type TentativaAvaliada,
} from "./events";
import { dominioInicial, evoluirDominio, type EstadoDeDominio } from "./mastery";
import {
  proximaRevisao,
  qualidadeDaResposta,
  type EstadoDeRevisao,
} from "./spaced-repetition";

/**
 * PLANO DA TENTATIVA — tudo que uma resposta produz, calculado sem tocar o banco.
 *
 * Mesma forma que o importador de conteúdo já provou: uma função pura traduz o
 * mundo para um plano de escrita, e a infraestrutura só grava o plano. É o que
 * permite testar exaustivamente a parte cara (BKT, Elo, SM-2, prêmio, eventos)
 * com aritmética, e deixar para o teste de integração apenas o que dublê nenhum
 * alcança: a transação.
 *
 * O que **não** está aqui é tão importante quanto o que está: crédito de XP,
 * carteira, energia, conquista, `QuestRun`. Nada disso é assunto de avaliação.
 * Sai tudo pelo evento (docs/08 §11).
 */

export interface DadosDaTentativa {
  readonly learnerId: string;
  readonly activityId: string;
  readonly questRunId: string | null;
  readonly resposta: unknown;
  readonly outcome: AttemptOutcome;
  readonly scoreRatio: number;
  readonly dicasUsadas: number;
  readonly duracaoMs: number;
  readonly equivoco: string | null;
  readonly idempotencyKey: string;
  /** Resposta que já tinha sido corrigida no navegador (devolutiva instantânea). */
  readonly avaliadaNoCliente: boolean;
  readonly criadaEm: Date;
}

export interface EscritaDeDominio {
  readonly skillId: string;
  /**
   * Versão que a linha tinha quando foi lida; `null` quando ainda não existe.
   *
   * A infraestrutura usa isto na atualização condicional. Carregar a versão no
   * plano — em vez de a infraestrutura reler — é o que mantém a leitura e o
   * cálculo consistentes: relerem seria olhar para um estado que já mudou.
   */
  readonly versaoEsperada: number | null;
  readonly anterior: EstadoDeDominio;
  readonly proximo: EstadoDeDominio;
}

export interface EscritaDeRevisao {
  readonly skillId: string;
  readonly proximo: EstadoDeRevisao;
}

export interface PlanoDaTentativa {
  readonly tentativa: DadosDaTentativa;
  /** `null` quando a criança pulou: pular não é evidência de nada. */
  readonly dominio: EscritaDeDominio | null;
  readonly revisao: EscritaDeRevisao | null;
  readonly premio: Premio | null;
  readonly eventos: readonly [
    DomainEvent<typeof TOPICO_TENTATIVA_AVALIADA, TentativaAvaliada>,
    DomainEvent<typeof TOPICO_TELEMETRIA_DE_TENTATIVA, RegistroDeTentativa>,
  ];
}

/** O que o repositório precisa ter carregado para o cálculo ser possível. */
export interface ContextoDaTentativa {
  readonly learnerId: string;
  /** Id pseudonimizado da criança. É o único id que sai em telemetria. */
  readonly pseudonymId: string;

  readonly activityId: string;
  readonly activityType: string;
  readonly objectiveId: string;
  readonly skillId: string;
  /** Dificuldade calibrada da atividade, escala Elo. */
  readonly dificuldade: number;
  /** `Skill.difficultyRef` — o nível que serve de prova de domínio. */
  readonly dificuldadeDeReferencia: number;

  readonly dominio: EstadoDeDominio | null;
  readonly revisao: EstadoDeRevisao | null;

  /** Quantas vezes esta criança já respondeu esta atividade antes. */
  readonly tentativasNaAtividade: number;
  /** Fôlego zerado corta o cosmético, nunca o aprendizado (docs/08 §4). */
  readonly semFolego: boolean;
}

export interface SubmissaoAvaliada {
  readonly resultado: EvaluationResult;
  /** P(guess) da atividade, do plugin. Entra no BKT. */
  readonly probabilidadeDeChute: number;
  /** Regra autorada. Atividade sem regra não paga — e isso é proposital. */
  readonly regraDeRecompensa: RegraDeRecompensa | null;
  readonly resposta: unknown;
  readonly dicasUsadas: number;
  readonly duracaoMs: number;
  readonly questRunId: string | null;
  readonly idempotencyKey: string;
  readonly avaliadaNoCliente: boolean;
  readonly traceId: string;
  readonly agora: Date;
}

export function planejarTentativa(
  contexto: ContextoDaTentativa,
  submissao: SubmissaoAvaliada,
): PlanoDaTentativa {
  const { resultado, agora } = submissao;
  const acertou = resultado.outcome === "CORRECT";

  /*
   * Pular não produz evidência.
   *
   * Tratar SKIPPED como erro seria a leitura mais fácil e a mais danosa: a
   * criança que pula para não se frustrar seria punida no modelo, veria
   * conteúdo mais fácil, e o sistema aprenderia a coisa errada sobre ela. A
   * tentativa continua sendo gravada — o *padrão* de pulos é informação
   * valiosa para o responsável — mas domínio e revisão não se movem.
   */
  const produzEvidencia = resultado.outcome !== "SKIPPED";

  const dominioAnterior = contexto.dominio ?? dominioInicial();

  const dominio: EscritaDeDominio | null = produzEvidencia
    ? {
        skillId: contexto.skillId,
        versaoEsperada: contexto.dominio?.versao ?? null,
        anterior: dominioAnterior,
        proximo: evoluirDominio(dominioAnterior, {
          acertou,
          scoreRatio: resultado.scoreRatio,
          probabilidadeDeChute: submissao.probabilidadeDeChute,
          dificuldadeDaAtividade: contexto.dificuldade,
          dificuldadeDeReferencia: contexto.dificuldadeDeReferencia,
          agora,
        }),
      }
    : null;

  const revisao: EscritaDeRevisao | null = produzEvidencia
    ? {
        skillId: contexto.skillId,
        proximo: proximaRevisao(
          contexto.revisao,
          qualidadeDaResposta(resultado.outcome, resultado.scoreRatio, submissao.dicasUsadas),
          agora,
        ),
      }
    : null;

  /*
   * O prêmio usa a habilidade de **antes** da tentativa.
   *
   * Usar a de depois pagaria o esforço com a régua que o próprio esforço acabou
   * de mover — quem acertasse algo difícil subiria de habilidade e receberia
   * como se a atividade tivesse sido fácil. O fator de dificuldade só significa
   * alguma coisa medido contra o ponto de partida.
   */
  const premio: Premio | null = submissao.regraDeRecompensa
    ? calcularPremio(submissao.regraDeRecompensa, {
        outcome: resultado.outcome,
        dicasUsadas: submissao.dicasUsadas,
        repeticoes: contexto.tentativasNaAtividade,
        dificuldadeDaAtividade: contexto.dificuldade,
        habilidadeDaCrianca: dominioAnterior.habilidade,
        semFolego: contexto.semFolego,
      })
    : null;

  const equivoco = "equivoco" in resultado ? (resultado.equivoco ?? null) : null;

  const tentativa: DadosDaTentativa = {
    learnerId: contexto.learnerId,
    activityId: contexto.activityId,
    questRunId: submissao.questRunId,
    resposta: submissao.resposta,
    outcome: resultado.outcome,
    scoreRatio: resultado.scoreRatio,
    dicasUsadas: submissao.dicasUsadas,
    duracaoMs: submissao.duracaoMs,
    equivoco,
    idempotencyKey: submissao.idempotencyKey,
    avaliadaNoCliente: submissao.avaliadaNoCliente,
    criadaEm: agora,
  };

  const dominouAgora =
    dominio !== null &&
    dominio.anterior.dominadaEm === null &&
    dominio.proximo.dominadaEm !== null;

  const evento = tentativaAvaliada(
    {
      learnerId: contexto.learnerId,
      activityId: contexto.activityId,
      objectiveId: contexto.objectiveId,
      skillId: contexto.skillId,
      questRunId: submissao.questRunId,
      outcome: resultado.outcome,
      scoreRatio: resultado.scoreRatio,
      primeiraVez: contexto.tentativasNaAtividade === 0,
      dicasUsadas: submissao.dicasUsadas,
      duracaoMs: submissao.duracaoMs,
      presentationTag: null,
      premio,
      dominio: dominio
        ? {
            probabilidade: dominio.proximo.probabilidade,
            habilidade: dominio.proximo.habilidade,
            dominouAgora,
          }
        : null,
      idempotencyKey: submissao.idempotencyKey,
    },
    submissao.traceId,
    agora,
  );

  const telemetria = telemetriaDeTentativa(
    {
      // Nunca `contexto.learnerId`. O tipo não tem o campo — ver `events.ts`.
      pseudonymId: contexto.pseudonymId,
      activityId: contexto.activityId,
      activityType: contexto.activityType,
      objectiveId: contexto.objectiveId,
      questRunId: submissao.questRunId,
      outcome: resultado.outcome,
      scoreRatio: resultado.scoreRatio,
      tentativa: contexto.tentativasNaAtividade + 1,
      dicasUsadas: submissao.dicasUsadas,
      duracaoMs: submissao.duracaoMs,
      equivoco,
      /*
       * Sem regra autorada não há prêmio, e zeros são o registro correto do
       * que aconteceu — nada foi concedido. `PlanoDaTentativa.premio` continua
       * `null`, que é o que a economia lê para decidir se credita.
       */
      premio: premio ?? PREMIO_VAZIO,
      dificuldade: contexto.dificuldade,
      habilidadeAntes: dominioAnterior.habilidade,
      ocorridoEm: agora,
    },
    submissao.traceId,
  );

  return { tentativa, dominio, revisao, premio, eventos: [evento, telemetria] };
}
