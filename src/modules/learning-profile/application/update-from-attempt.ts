import { TOPICO_TENTATIVA_AVALIADA, type TentativaAvaliada } from "@/modules/assessment";
import type { DomainEvent, EventHandler, Transacao } from "@/shared/kernel";

import { sugestaoQualificada } from "../domain/accessibility-recommendation";
import {
  contaComoEvidencia,
  mudouOSuficiente,
  recomputarDimensao,
  type DimensaoRecomputada,
} from "../domain/dimension";
import { dimensoesRelevantes } from "../domain/dimension-rules";
import type { LearningProfileDeps } from "./ports";

/**
 * Atualiza o Learning Profile a cada tentativa avaliada.
 *
 * **Outbox, não inline.** O perfil de aprendizagem informa a *próxima*
 * missão, nunca a que a criança acabou de responder — não há motivo para
 * competir com a Luz, o Fôlego e a carteira pelo orçamento de latência da
 * submissão (mesmo raciocínio de `achievement`, docs/HANDOFF.md §5 item 3).
 *
 * Sem sinal, sem trabalho: a maior parte das atividades do acervo hoje não
 * declara nenhuma característica de apresentação (`Activity.visualSupportLevel`
 * etc. são todos opcionais), e este handler simplesmente não faz nada nesse
 * caso — não há característica a que atribuir o desempenho. A partir do
 * momento em que uma atividade declarar (Fase 2), o mesmo handler, sem
 * mudança nenhuma, começa a aprender com ela.
 *
 * Também é aqui, na mesma transação, que uma dimensão com evidência o
 * bastante vira uma sugestão de acessibilidade para o responsável (Fase 3b,
 * `considerarRecomendacao`) — nunca aplicada sozinha: só a criação da
 * `Recommendation`. Quem decide se ela vira `LearnerSettings` de verdade é o
 * responsável, na tela "Personalização da Aprendizagem".
 */
export function criarAtualizarPerfilAPartirDeTentativa(
  deps: LearningProfileDeps,
): EventHandler<DomainEvent<typeof TOPICO_TENTATIVA_AVALIADA, TentativaAvaliada>> {
  return {
    topico: TOPICO_TENTATIVA_AVALIADA,
    modo: "outbox",

    async tratar(evento, tx: Transacao) {
      if (!contaComoEvidencia(evento.payload.outcome)) return;

      const caracteristicas = await deps.repositorio.buscarCaracteristicas(
        evento.payload.activityId,
        tx,
      );
      if (!caracteristicas) return;

      const chaves = dimensoesRelevantes(caracteristicas);
      if (chaves.length === 0) return;

      const perfilId = await deps.repositorio.obterOuCriarPerfil(
        evento.payload.learnerId,
        null, // Fase 1: só o perfil global. Por academia fica para quando houver dado que justifique.
        tx,
      );

      for (const chave of chaves) {
        const scores = await deps.repositorio.buscarScoresRelevantes(
          evento.payload.learnerId,
          chave,
          tx,
        );
        const recomputado = recomputarDimensao(scores);
        if (recomputado === null) continue;

        const anterior = await deps.repositorio.obterDimensao(perfilId, chave, tx);
        if (anterior === null || mudouOSuficiente(anterior, recomputado)) {
          await deps.repositorio.salvarDimensao(perfilId, chave, recomputado, anterior, tx);
        }

        await considerarRecomendacao(deps, evento.payload.learnerId, chave, recomputado, tx);
      }
    },
  };
}

/**
 * Uma dimensão com evidência o bastante talvez mereça virar sugestão para o
 * responsável (Fase 3b) — checado a cada evento com sinal, não só quando o
 * valor muda o suficiente para gravar auditoria: um perfil que já qualificava
 * antes desta feature existir também precisa ganhar sua sugestão, na próxima
 * vez que houver evidência.
 *
 * Nunca sugere duas vezes em cima da mesma dimensão sem resposta
 * (`existeRecomendacaoPendente`), nem o que o responsável já ligou
 * (`valorAtualDaConfiguracao`) — o guarda contra incomodar por incomodar.
 */
async function considerarRecomendacao(
  deps: LearningProfileDeps,
  learnerId: string,
  dimensionKey: string,
  dimensao: DimensaoRecomputada,
  tx: Transacao,
): Promise<void> {
  const sugestao = sugestaoQualificada(dimensionKey, dimensao.confidence, dimensao.value);
  if (!sugestao) return;

  const jaAtivo = await deps.repositorio.valorAtualDaConfiguracao(
    learnerId,
    sugestao.settingField,
    tx,
  );
  if (jaAtivo === true) return;

  const jaPendente = await deps.repositorio.existeRecomendacaoPendente(
    learnerId,
    dimensionKey,
    tx,
  );
  if (jaPendente) return;

  await deps.repositorio.criarRecomendacaoDeAcessibilidade(
    learnerId,
    sugestao,
    dimensao.confidence,
    tx,
  );
}
