import {
  TOPICO_MISSAO_CONCLUIDA,
  TOPICO_MISSAO_INICIADA,
  type MissaoConcluida,
  type MissaoIniciada,
} from "@/modules/quest";
import type { DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import { aplicarGanho, progressoInicial } from "../domain/progress";
import { diaCivil } from "../domain/streak";
import type { ProgressionDeps } from "./ports";

/**
 * O que a progressão faz quando uma missão começa e quando ela termina.
 *
 * São dois manipuladores porque são dois momentos com regras opostas: começar
 * **custa** Fôlego, terminar **rende** Luz. Juntá-los num só esconderia isso.
 */

/**
 * Cobra o Fôlego de iniciar (docs/08 §4).
 *
 * ── A regra que este manipulador não pode violar ──
 * **Ele nunca recusa.** Não existe caminho aqui que devolva erro por falta de
 * Fôlego, e a ausência é a garantia: energia zerada não impede jogar. O saldo
 * desce até zero e para — o que a criança perde é o cosmético e a moeda, nunca
 * a Luz e nunca o domínio. Bloquear aprendizagem violaria P1 e P2 da Bíblia.
 *
 * Retomar não custa nada: `custoDeFolego` chega zerado nesse caso. Cobrar de
 * quem volta ensinaria a criança a não fechar o app — o oposto do que
 * `QuestRun` existe para permitir.
 */
export function criarCobrancaDeFolego(
  deps: ProgressionDeps,
): EventHandler<DomainEvent<typeof TOPICO_MISSAO_INICIADA, MissaoIniciada>> {
  return {
    topico: TOPICO_MISSAO_INICIADA,
    modo: "inline",

    async tratar(evento, tx: Transacao) {
      const { learnerId, custoDeFolego } = evento.payload;
      if (custoDeFolego <= 0) return;

      const agora = deps.clock.now();
      const carregado = await deps.repositorio.carregar(learnerId, tx);

      // Quem nunca jogou tem Fôlego cheio; a linha nasce já com o custo pago.
      const atual = carregado ?? progressoInicial(agora);

      /*
       * O ganho é zero em tudo — só o Fôlego muda. Usar `aplicarGanho` mesmo
       * assim é o que garante que a regeneração pelo tempo parado aconteça
       * antes da cobrança: sem isso, uma criança que voltasse depois de horas
       * pagaria sobre o saldo antigo.
       *
       * `dia: null` porque começar não é concluir (docs/08 §6).
       */
      const regenerado = aplicarGanho(atual, { luz: 0, folego: 0, agora, dia: null });

      const proximo = {
        ...regenerado.proximo,
        // Piso em zero. Saldo negativo de Fôlego não existe no produto.
        folego: Math.max(0, regenerado.proximo.folego - custoDeFolego),
      };

      if (carregado === null) {
        await deps.repositorio.criar(learnerId, proximo, tx);
      } else {
        await deps.repositorio.atualizar(learnerId, atual.versao, proximo, tx);
      }
    },
  };
}

/**
 * Credita a recompensa da missão e avança a Trilha de Luz.
 *
 * ── É aqui que a Trilha anda, e não na tentativa ──
 * `docs/08 §6` conta "dias com ≥ 1 missão concluída". A diferença não é
 * burocrática: a sequência premia **terminar o que se começou**, não abrir o
 * app e responder uma pergunta. Uma Trilha que anda com qualquer toque vale
 * menos para a criança justamente porque custa menos.
 *
 * A concessão é única por jogada — `quest` só publica este evento depois de
 * marcar `rewardsGrantedAt`, e a chave no payload existe para o caso de o
 * evento chegar duas vezes.
 */
export function criarCreditoDeMissao(
  deps: ProgressionDeps,
): EventHandler<DomainEvent<typeof TOPICO_MISSAO_CONCLUIDA, MissaoConcluida>> {
  return {
    topico: TOPICO_MISSAO_CONCLUIDA,
    modo: "inline",

    async tratar(evento, tx: Transacao) {
      const { learnerId, premio } = evento.payload;

      const agora = deps.clock.now();
      const fuso = await deps.repositorio.fusoDoResponsavel(learnerId);
      const carregado = await deps.repositorio.carregar(learnerId, tx);
      const atual = carregado ?? progressoInicial(agora);

      const atualizado = aplicarGanho(atual, {
        luz: premio.xp,
        folego: 0,
        agora,
        dia: diaCivil(agora, fuso),
      });

      if (carregado === null) {
        await deps.repositorio.criar(learnerId, atualizado.proximo, tx);
      } else {
        await deps.repositorio.atualizar(learnerId, atual.versao, atualizado.proximo, tx);
      }
    },
  };
}
