"use server";

import { z } from "zod";

import {
  atividadeEm,
  avaliarAtividade,
  premioDaAtividade,
  registroPadrao,
  resolverApresentacao,
  totalDeAtividades,
  type MissaoNaSessao,
} from "@/activities";
import { carregarMissaoParaSessao } from "@/activities/content-bridge";
import { createAction } from "@/server/action";
import { err, notFound, ok } from "@/shared/kernel";

/**
 * Correção de uma atividade — **no servidor, autoritativa**.
 *
 * A criança pode receber devolutiva instantânea rodando o mesmo `evaluate` no
 * navegador (é função pura, o mesmo código), mas quem decide o que vale é esta
 * ação. Resposta enviada pelo cliente nunca traz o resultado: traz só a
 * resposta. Pontuação que chega do cliente é pontuação forjável.
 */
export const responderAtividadeAction = createAction({
  nome: "activity.submit_answer",
  escopo: "crianca",
  entrada: z.object({
    missaoSlug: z.string().min(1).max(80),
    atividadeSlug: z.string().min(1).max(80),
    /** JSON da resposta. Validado adiante pelo `answerSchema` do plugin. */
    resposta: z.string().max(20_000),
    dicasUsadas: z.coerce.number().int().min(0).max(10).default(0),
    tentativa: z.coerce.number().int().min(1).max(50).default(1),
    duracaoMs: z.coerce.number().int().min(0).max(3_600_000).default(0),
  }),

  executar: async ({ entrada }) => {
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

    const resultado = avaliarAtividade(
      registroPadrao,
      { type: atividade.tipo, config: atividade.config },
      resposta,
      {
        dicasUsadas: entrada.dicasUsadas,
        tentativa: entrada.tentativa,
        duracaoMs: entrada.duracaoMs,
        locale: "pt-BR",
      },
    );
    if (!resultado.ok) return resultado;

    /*
     * Habilidade fixa em 1000 (centro da escala Elo) enquanto o módulo
     * `assessment` não existe. É um valor honesto de partida, não um palpite
     * escondido: sem histórico de tentativas, o sistema realmente não sabe onde
     * a criança está. Quando `SkillMastery` entrar, este número vem de lá e o
     * resto do cálculo não muda.
     */
    const premio = premioDaAtividade(atividade, resultado.value, {
      dicasUsadas: entrada.dicasUsadas,
      repeticoes: entrada.tentativa - 1,
      habilidadeDaCrianca: 1000,
      semFolego: false,
    });

    const tom = resultado.value.feedback?.tom ?? "ORIENTA";

    return ok({
      resultado: resultado.value,
      premio,
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
