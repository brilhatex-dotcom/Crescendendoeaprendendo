"use server";

import { z } from "zod";

import {
  atividadeEm,
  avaliarAtividade,
  chuteDaAtividade,
  registroPadrao,
  resolverApresentacao,
  totalDeAtividades,
  type MissaoNaSessao,
} from "@/activities";
import { carregarMissaoParaSessao } from "@/activities/content-bridge";
import { containerDeAvaliacao } from "@/composition/assessment";
import { createAction } from "@/server/action";
import { err, internalError, notFound, ok } from "@/shared/kernel";

/**
 * AS TRÊS AÇÕES DE UMA JOGADA: abrir, responder e fechar.
 *
 * Todas passam por `createAction`, todas exigem sub-sessão de criança em vigor,
 * e nenhuma aceita do cliente uma afirmação que valha dinheiro. É o servidor
 * que corrige, que conta as respostas e que decide que a missão acabou.
 */
/**
 * Abrir a missão — cria a jogada ou devolve a que estava em andamento.
 *
 * É uma ação, e não algo que a página faz ao renderizar, por um motivo
 * concreto: o Next pré-carrega links. Iniciar a missão no render faria o
 * simples fato de a criança olhar o mapa cobrar Fôlego de missões que ela nunca
 * jogou.
 */
export const abrirMissaoAction = createAction({
  nome: "quest.open",
  escopo: "crianca",
  entrada: z.object({
    missaoSlug: z.string().min(1).max(80),
  }),

  executar: async ({ entrada, ator, ctx }) => {
    if (!ator?.activeLearnerId) {
      return err(internalError("quest.invalid_context", "Contexto de jogada incompleto."));
    }

    const missao = await carregarMissaoParaSessao(entrada.missaoSlug, ator.activeLearnerId);
    if (!missao) {
      return err(notFound("quest.not_found", "Esta missão não existe."));
    }

    const { abrirJogada } = containerDeAvaliacao();

    const resultado = await abrirJogada({
      learnerId: ator.activeLearnerId,
      refDaMissao: missao.ref,
      traceId: ctx.traceId,
    });
    if (!resultado.ok) return resultado;

    /*
     * Relida depois de abrir: é só agora que um slot dinâmico (docs/08 §7)
     * pode ter atividade de verdade — a versão que a página montou antes do
     * clique podia não ter todas ainda (a Fila de Revisão, por exemplo,
     * começa sem nenhuma). O cliente troca a missão que está usando por esta,
     * e os índices que `abrirJogada` devolveu passam a apontar para o lugar
     * certo nela.
     */
    const missaoResolvida = (await carregarMissaoParaSessao(
      entrada.missaoSlug,
      ator.activeLearnerId,
    )) ?? missao;

    return ok({ ...resultado.value, missao: missaoResolvida });
  },
});

/**
 * Fechar a missão.
 *
 * Quem decide que a missão acabou é o servidor, contando as tentativas
 * gravadas — nunca o cliente. Sem isso, um toque forjado concederia
 * `Quest.rewardXp` sem uma única resposta.
 */
export const concluirMissaoAction = createAction({
  nome: "quest.complete",
  escopo: "crianca",
  entrada: z.object({
    missaoSlug: z.string().min(1).max(80),
    questRunId: z.string().min(1).max(60),
  }),

  executar: async ({ entrada, ator, ctx }) => {
    if (!ator?.activeLearnerId) {
      return err(internalError("quest.invalid_context", "Contexto de jogada incompleto."));
    }

    const missao = await carregarMissaoParaSessao(entrada.missaoSlug, ator.activeLearnerId);
    if (!missao) {
      return err(notFound("quest.not_found", "Esta missão não existe."));
    }

    const { concluirJogada } = containerDeAvaliacao();

    return concluirJogada({
      learnerId: ator.activeLearnerId,
      questRunId: entrada.questRunId,
      refDaMissao: missao.ref,
      traceId: ctx.traceId,
    });
  },
});

/**
 * Correção de uma atividade — **no servidor, autoritativa**.
 *
 * A criança pode receber devolutiva instantânea rodando o mesmo `evaluate` no
 * navegador (é função pura, o mesmo código), mas quem decide o que vale é esta
 * ação. Resposta enviada pelo cliente nunca traz o resultado: traz só a
 * resposta. Pontuação que chega do cliente é pontuação forjável.
 *
 * Corrigir e medir são trabalhos diferentes, e a divisão é visível aqui: esta
 * ação corrige (é ela que tem o conteúdo autorado carregado) e entrega o
 * veredito ao módulo `assessment`, que grava o histórico, atualiza o modelo de
 * domínio e agenda a revisão. O prêmio volta de lá porque só lá se conhece a
 * habilidade da criança — e sem ela o fator de dificuldade seria um chute.
 */
export const responderAtividadeAction = createAction({
  nome: "activity.submit_answer",
  escopo: "crianca",
  // Primeira ação do sistema com efeito econômico (docs/09 §4, passo 5).
  idempotente: true,
  entrada: z.object({
    missaoSlug: z.string().min(1).max(80),
    atividadeSlug: z.string().min(1).max(80),
    /** JSON da resposta. Validado adiante pelo `answerSchema` do plugin. */
    resposta: z.string().max(20_000),
    /** Jogada em curso. É o que liga a tentativa à missão (`QuestRun`). */
    questRunId: z.string().max(60).optional(),
    dicasUsadas: z.coerce.number().int().min(0).max(10).default(0),
    tentativa: z.coerce.number().int().min(1).max(50).default(1),
    duracaoMs: z.coerce.number().int().min(0).max(3_600_000).default(0),
  }),

  executar: async ({ entrada, ator, ctx }) => {
    /*
     * O escopo `crianca` já garantiu que a sub-sessão está aberta e que o
     * `activeLearnerId` do banco confere com o cookie assinado. A checagem
     * abaixo é o que converte essa garantia em tipo — e é o compilador, não a
     * disciplina, que impede alguém de gravar tentativa sem dono.
     */
    if (!ator?.activeLearnerId || !ctx.idempotencyKey) {
      return err(internalError("activity.invalid_context", "Contexto de jogada incompleto."));
    }

    const missao = await carregarMissaoParaSessao(entrada.missaoSlug, ator.activeLearnerId);
    if (!missao) {
      return err(notFound("quest.not_found", "Esta missão não existe."));
    }

    const atividade = encontrarAtividade(missao, entrada.atividadeSlug);
    if (!atividade) {
      return err(notFound("activity.not_found", "Atividade não encontrada nesta missão."));
    }

    let resposta: unknown;
    try {
      resposta = JSON.parse(entrada.resposta);
    } catch {
      resposta = null;
    }

    const alvo = { type: atividade.tipo, config: atividade.config };

    const resultado = avaliarAtividade(registroPadrao, alvo, resposta, {
      dicasUsadas: entrada.dicasUsadas,
      tentativa: entrada.tentativa,
      duracaoMs: entrada.duracaoMs,
      locale: "pt-BR",
    });
    if (!resultado.ok) return resultado;

    // P(guess) do BKT. Vem do plugin porque depende da config: múltipla escolha
    // com 2 opções é 0.5; com 5, é 0.2 (docs/08 §2).
    const chute = chuteDaAtividade(registroPadrao, alvo);
    if (!chute.ok) return chute;

    const { submeterTentativa } = containerDeAvaliacao();

    const registro = await submeterTentativa({
      learnerId: ator.activeLearnerId,
      refDaAtividade: atividade.ref,
      resultado: resultado.value,
      probabilidadeDeChute: chute.value,
      regraDeRecompensa: atividade.recompensa ?? null,
      resposta,
      dicasUsadas: entrada.dicasUsadas,
      duracaoMs: entrada.duracaoMs,
      /*
       * A jogada em curso. Anulável de propósito: uma tentativa fora de missão
       * — treino livre, revisão avulsa — continua sendo histórico e continua
       * movendo o modelo de domínio. O que ela não faz é avançar corrida
       * nenhuma, e o manipulador de `quest` simplesmente não age.
       */
      questRunId: entrada.questRunId ?? null,
      idempotencyKey: ctx.idempotencyKey,
      // O cliente já mostrou a devolutiva antes desta resposta chegar.
      avaliadaNoCliente: true,
      traceId: ctx.traceId,
    });
    if (!registro.ok) return registro;

    const tom = resultado.value.feedback?.tom ?? "ORIENTA";

    return ok({
      resultado: resultado.value,
      premio: registro.value.premio,
      /** `true` quando esta resposta já tinha sido registrada. Nada foi concedido. */
      repetida: registro.value.repetida,
      dominouAgora: registro.value.dominio?.dominouAgora ?? false,
      apresentacao: resolverApresentacao(tom, undefined),
      totalDeAtividades: totalDeAtividades(missao),
    });
  },
});

function encontrarAtividade(missao: MissaoNaSessao, slug: string) {
  for (let f = 0; f < missao.fases.length; f += 1) {
    const fase = missao.fases[f];
    if (!fase) continue;
    for (let a = 0; a < fase.atividades.length; a += 1) {
      if (fase.atividades[a]?.slug === slug) {
        return atividadeEm(missao, { fase: f, atividade: a });
      }
    }
  }
  return null;
}
