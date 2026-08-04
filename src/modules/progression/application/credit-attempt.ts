import {
  TOPICO_TENTATIVA_AVALIADA,
  type TentativaAvaliada,
} from "@/modules/assessment";
import type { DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import { aplicarGanho, progressoInicial } from "../domain/progress";
import { diaCivil } from "../domain/streak";
import type { ProgressionDeps } from "./ports";

/**
 * Credita a Luz de uma tentativa.
 *
 * ── Por que é um manipulador de evento, e não uma chamada ──
 * `assessment` não conhece este arquivo e nunca vai conhecer. Ele publica "uma
 * tentativa foi avaliada" e segue; quem entende de Luz reage. Adicionar um
 * efeito novo — conquista, missão em família, aviso ao responsável — é
 * registrar outro manipulador no composition root, sem tocar em avaliação
 * (`docs/01 §2`).
 *
 * ── Por que é `inline`, e não outbox ──
 * `docs/08 §11` exige `LearnerProgress` na mesma transação da tentativa. O
 * motivo prático é a criança: com a Luz saindo pelo outbox, ela terminaria a
 * atividade e não veria nada acontecer até o despachante rodar. Um minuto de
 * espera, aos sete anos, é o mesmo que não ter acontecido.
 *
 * ── Sobre o tipo importado de `assessment` ──
 * Vem da API pública do módulo, e só o tipo. É a forma do contrato de
 * integração: quem reage a um evento precisa saber o que ele carrega. A
 * dependência é de mão única e não cria ciclo.
 */
export function criarCreditoDeTentativa(
  deps: ProgressionDeps,
): EventHandler<DomainEvent<typeof TOPICO_TENTATIVA_AVALIADA, TentativaAvaliada>> {
  return {
    topico: TOPICO_TENTATIVA_AVALIADA,
    modo: "inline",

    async tratar(evento, tx: Transacao) {
      const { learnerId, premio } = evento.payload;

      /*
       * Sem prêmio não há o que creditar — mas a Trilha de Luz **ainda assim**
       * avança. Uma atividade sem regra de recompensa continua sendo um dia em
       * que a criança apareceu, e a sequência mede presença, não pontuação.
       */
      const agora = deps.clock.now();
      const fuso = await deps.repositorio.fusoDoResponsavel(learnerId);

      /*
       * O `null` da leitura é o que distingue criar de atualizar — e não a
       * versão ser zero. Uma linha existente na versão 0 é o caso normal de
       * quem tem `LearnerProgress` mas nunca ganhou Luz; tratá-la como nova
       * bateria na chave primária e o erro pareceria corrida quando não é.
       */
      const carregado = await deps.repositorio.carregar(learnerId, tx);
      const atual = carregado ?? progressoInicial(agora);

      const atualizado = aplicarGanho(atual, {
        luz: premio?.xp ?? 0,
        folego: premio?.folego ?? 0,
        agora,
        dia: diaCivil(agora, fuso),
      });

      if (carregado === null) {
        await deps.repositorio.criar(learnerId, atualizado.proximo, tx);
      } else {
        await deps.repositorio.atualizar(learnerId, atual.versao, atualizado.proximo, tx);
      }

      const desbloqueios = premio?.desbloqueios ?? [];
      if (desbloqueios.length > 0) {
        await deps.repositorio.registrarDesbloqueios(learnerId, desbloqueios, tx);
      }
    },
  };
}
