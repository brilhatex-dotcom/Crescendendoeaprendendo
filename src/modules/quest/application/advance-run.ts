import type { SeletorDeAtividades } from "@/activities";
import {
  TOPICO_TENTATIVA_AVALIADA,
  type TentativaAvaliada,
} from "@/modules/assessment";
import type { Clock, DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import { posicaoDaRetomada } from "../domain/quest-run";
import type { RepositorioDeMissoes, RepositorioDeSlots } from "./ports";
import { criarResolverSlots } from "./resolve-slots";

/**
 * Faz a corrida acompanhar as respostas.
 *
 * ── Por que é um manipulador, e não uma chamada de `assessment` ──
 * Avaliar não deveria saber que missões existem. Aqui `quest` escuta o mesmo
 * evento que a progressão e a economia escutam, e usa a parte que lhe diz
 * respeito: o `questRunId`. Se um dia a tentativa passar a acontecer fora de
 * uma missão — treino livre, revisão avulsa —, este manipulador simplesmente
 * não faz nada, e nenhuma outra linha do sistema muda.
 *
 * ── Por que `inline` ──
 * A posição da retomada é o que a criança vê ao voltar. Atualizá-la fora da
 * transação abriria a janela em que ela responde, o app cai, e ela volta para
 * uma atividade que já respondeu — que é exatamente o susto que `QuestRun`
 * existe para evitar.
 */
export function criarAvancoDaCorrida(deps: {
  readonly repositorio: RepositorioDeMissoes;
  readonly slots: RepositorioDeSlots;
  readonly seletor: SeletorDeAtividades;
  readonly clock: Clock;
}): EventHandler<DomainEvent<typeof TOPICO_TENTATIVA_AVALIADA, TentativaAvaliada>> {
  const resolverSlots = criarResolverSlots({ slots: deps.slots, seletor: deps.seletor });

  return {
    topico: TOPICO_TENTATIVA_AVALIADA,
    modo: "inline",

    async tratar(evento, tx: Transacao) {
      const { questRunId, premio } = evento.payload;

      // Tentativa fora de missão: nada a acompanhar.
      if (!questRunId) return;

      const corrida = await deps.repositorio.corridaPorId(questRunId, tx);
      if (!corrida || corrida.status !== "IN_PROGRESS") return;

      /*
       * A tentativa que gerou este evento **já está gravada** — o repositório de
       * avaliação escreveu antes de o barramento publicar, na mesma transação.
       * Por isso a contagem abaixo já a inclui, e a posição sai certa sem que
       * este manipulador precise saber qual atividade foi.
       */
      const missaoDeclarada = await deps.repositorio.buscarMissaoPorQuestId(corrida.questId, tx);
      if (!missaoDeclarada) return;

      // Missão já resolvida ao abrir a jogada — aqui só se lê o que já existe.
      const missao = await resolverSlots(
        missaoDeclarada,
        { learnerId: corrida.learnerId, questRunId, agora: deps.clock.now() },
        tx,
      );

      const respondidas = await deps.repositorio.atividadesRespondidas(questRunId, tx);
      const posicao = posicaoDaRetomada(missao, respondidas);

      /*
       * A pontuação da jogada acumula a Luz das atividades. É o número que
       * aparece no fim da missão — e o motivo de ele viver em `QuestRun` e não
       * ser recalculado: quando a recompensa de repetição decair, a pontuação
       * daquela jogada continua sendo a que ela fez naquele dia.
       */
      await deps.repositorio.avancar(
        questRunId,
        posicao.fase,
        corrida.pontuacao + (premio?.xp ?? 0),
        tx,
      );
    },
  };
}
