import type { CandidataAtividade, PedidoDeSelecao, SeletorDeAtividades } from "@/activities";
import { ELO } from "@/modules/assessment";
import type { Transacao } from "@/shared/kernel";

import type { DadosDaMissao } from "../domain/quest-run";
import {
  agruparSlotsPendentes,
  chaveDoSlot,
  faixaCompativel,
  mesclarAtividades,
} from "../domain/slot-resolution";
import type { RepositorioDeSlots, ResolucaoDeSlot } from "./ports";

/**
 * PREENCHER O SLOT DINÂMICO DA MISSÃO (docs/08 §7).
 *
 * A parte do motor que este arquivo liga: `StageActivity.activityId` nulo,
 * `SkillMastery.ability` gravado a cada tentativa, e `seletorPorProximidade`
 * — três peças que já existiam, esperando quem as chamasse.
 *
 * ── Por que a resolução é gravada, não recalculada ──
 * A criança que retoma a jogada tem que ver a mesma atividade que viu antes,
 * mesmo que a habilidade dela tenha mudado nesse meio-tempo — senão o slot
 * troca de figura no meio da corrida, e a posição da retomada (que conta
 * `Attempt` por `activityId`) perderia o sentido. Por isso a primeira
 * chamada resolve e grava; toda chamada depois só lê `slotsResolvidos`.
 *
 * ── Por que 48h e não "desde sempre" ──
 * docs/08 §7.2 pede para não repetir o que a criança viu recentemente, não
 * banir para sempre: um acervo pequeno esgotaria candidata rápido se a
 * exclusão fosse permanente, e a criança acabaria sem nenhuma opção.
 */

const JANELA_DE_REPETICAO_HORAS = 48;

export type ResolverSlots = (
  missao: DadosDaMissao,
  entrada: { readonly learnerId: string; readonly questRunId: string; readonly agora: Date },
  tx: Transacao,
) => Promise<DadosDaMissao>;

export function criarResolverSlots(deps: {
  readonly slots: RepositorioDeSlots;
  readonly seletor: SeletorDeAtividades;
}): ResolverSlots {
  return async function resolverSlotsDaMissao(missao, { learnerId, questRunId, agora }, tx) {
    // Toda missão de hoje passa por aqui e sai sem custo: sem slot declarado,
    // não há nada a resolver.
    if (missao.slotsPendentes.length === 0) return missao;

    const jaResolvidos = await deps.slots.slotsResolvidos(questRunId, tx);
    const pendentes = missao.slotsPendentes.filter(
      (slot) => !jaResolvidos.has(chaveDoSlot(slot)),
    );

    if (pendentes.length === 0) {
      return { ...missao, atividades: mesclarAtividades(missao, jaResolvidos) };
    }

    const grupos = agruparSlotsPendentes(pendentes);
    const objectiveIds = [...new Set(grupos.map((grupo) => grupo.regra.objectiveId))];

    const contexto = await deps.slots.contexto(learnerId, objectiveIds, tx);

    /*
     * Criança não encontrada — não há nada seguro para inventar em seu lugar.
     * Os slots seguem pendentes e a mesclagem os descarta, o mesmo destino de
     * um slot que nunca teve `activityId`.
     */
    if (!contexto) {
      return { ...missao, atividades: mesclarAtividades(missao, jaResolvidos) };
    }

    const desde = new Date(agora.getTime() - JANELA_DE_REPETICAO_HORAS * 60 * 60 * 1000);
    const vistasRecentemente = await deps.slots.vistasRecentemente(learnerId, desde, tx);

    /*
     * A mesma atividade não deveria aparecer duas vezes na mesma missão — não
     * é uma regra de docs/08 §7, mas sai de graça do conjunto que já existe
     * por outro motivo, e evita uma repetição estranha para a criança.
     */
    const usadasNestaMissao = new Set<string>([
      ...missao.atividades.map((atividade) => atividade.activityId),
      ...jaResolvidos.values(),
    ]);

    const excluir = [...vistasRecentemente, ...usadasNestaMissao];
    const novasResolucoes: ResolucaoDeSlot[] = [];

    for (const grupo of grupos) {
      const habilidadeDaCompetencia =
        contexto.habilidadePorObjetivo.get(grupo.regra.objectiveId) ?? ELO.centro;

      const brutas = await deps.slots.candidatas(grupo.regra.objectiveId, contexto.locale, tx);
      const candidatas: CandidataAtividade[] = brutas
        .filter((candidata) =>
          faixaCompativel(candidata.minAgeBand, candidata.maxAgeBand, contexto.ageBand),
        )
        .map((candidata) => ({
          activityId: candidata.activityId,
          type: candidata.type,
          dificuldade: candidata.dificuldade,
        }));

      const pedido: PedidoDeSelecao = {
        habilidade: habilidadeDaCompetencia + grupo.regra.difficultyDelta,
        objectiveId: grupo.regra.objectiveId,
        excluir,
        tiposRecentes: [],
        quantidade: grupo.slots.length,
      };

      const escolhidas = deps.seletor.selecionar(pedido, candidatas);
      const slotsEmOrdem = [...grupo.slots].sort((a, b) => a.order - b.order);

      for (let i = 0; i < slotsEmOrdem.length; i += 1) {
        const slot = slotsEmOrdem[i];
        const escolhida = escolhidas[i];
        // Acervo sem candidata suficiente para este objetivo: o slot segue
        // pendente, tentado de novo na próxima abertura — não há erro aqui,
        // só um acervo que ainda precisa crescer.
        if (!slot || !escolhida) continue;

        novasResolucoes.push({
          stageId: slot.stageId,
          order: slot.order,
          activityId: escolhida.activityId,
        });
      }
    }

    const resolvidos =
      novasResolucoes.length > 0
        ? await deps.slots.resolver(questRunId, novasResolucoes, tx)
        : jaResolvidos;

    return { ...missao, atividades: mesclarAtividades(missao, resolvidos) };
  };
}
