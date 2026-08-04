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

    const missao = await carregarMissaoParaSessao(entrada.missaoSlug);
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
       * `QuestRun` ainda não é criado por ninguém — a jogada retomável é o
       * passo seguinte da Etapa 2. A coluna é anulável por desenho, e uma
       * tentativa sem corrida é exatamente o que acontece hoje: o histórico e o
       * modelo de domínio ficam corretos; o que falta é o agrupamento por
       * jogada, e ele entra sem alterar nada disto.
       */
      questRunId: null,
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
