import { FOLEGO, devolver, regenerar } from "./energy";
import { nivelParaLuz, tierDoNivel, type Tier } from "./level";
import { registrarDia, type EstadoDaTrilha } from "./streak";

/**
 * PROGRESSO — o que a criança vê crescer.
 *
 * Junta Luz, nível, Fôlego e Trilha de Luz num estado só, porque uma tentativa
 * mexe em todos ao mesmo tempo e atualizá-los em passos separados abriria a
 * porta para estados impossíveis: nível 12 com Luz de nível 3, sequência de 40
 * dias sem nenhum dia registrado.
 *
 * Função pura. `docs/08 §1`, `§4` e `§6`.
 */

export interface EstadoDeProgresso {
  readonly luzTotal: number;
  readonly nivel: number;
  readonly tier: Tier;
  readonly folego: number;
  readonly folegoAtualizadoEm: Date;
  readonly trilha: EstadoDaTrilha;
  /** Atualização condicional (docs/08 §11). Linha quente. */
  readonly versao: number;
}

export const progressoInicial = (agora: Date): EstadoDeProgresso => ({
  luzTotal: 0,
  nivel: 1,
  tier: "APRENDIZ",
  folego: FOLEGO.maximo,
  folegoAtualizadoEm: agora,
  trilha: { dias: 0, recorde: 0, lanternas: 1, ultimoDia: null },
  versao: 0,
});

export interface GanhoDaTentativa {
  /** Luz concedida pela atividade. Pode ser zero; nunca é negativa. */
  readonly luz: number;
  /** Fôlego devolvido pelo prêmio. Responder jamais gasta Fôlego. */
  readonly folego: number;
  readonly agora: Date;
  /** Data civil no fuso do responsável, para a Trilha de Luz. */
  readonly dia: string;
}

export interface ProgressoAtualizado {
  readonly anterior: EstadoDeProgresso;
  readonly proximo: EstadoDeProgresso;
  readonly subiuDeNivel: boolean;
  /** `true` só na tentativa em que o tier mudou — é o momento de celebrar. */
  readonly mudouDeTier: boolean;
  /** `true` quando este é o primeiro dia da sequência a ser registrado hoje. */
  readonly diaNovoNaTrilha: boolean;
}

/**
 * Aplica o ganho de uma tentativa.
 *
 * Ordem: regenera o Fôlego pelo tempo parado, **depois** credita. O contrário
 * descartaria a regeneração acumulada toda vez que um prêmio devolvesse
 * Fôlego — e o prêmio viraria uma punição para quem esperou.
 */
export function aplicarGanho(
  atual: EstadoDeProgresso,
  ganho: GanhoDaTentativa,
): ProgressoAtualizado {
  const regenerado = regenerar(atual.folego, atual.folegoAtualizadoEm, ganho.agora);

  // Luz nunca diminui (docs/08 §1): ganho negativo é dado corrompido, não regra.
  const luzTotal = atual.luzTotal + Math.max(0, Math.round(ganho.luz));
  const nivel = nivelParaLuz(luzTotal);
  const tier = tierDoNivel(nivel);

  const trilha = registrarDia(atual.trilha, ganho.dia);

  const proximo: EstadoDeProgresso = {
    luzTotal,
    nivel,
    tier,
    folego: devolver(regenerado.folego, ganho.folego),
    folegoAtualizadoEm: regenerado.atualizadoEm,
    trilha,
    versao: atual.versao + 1,
  };

  return {
    anterior: atual,
    proximo,
    subiuDeNivel: proximo.nivel > atual.nivel,
    mudouDeTier: proximo.tier !== atual.tier,
    diaNovoNaTrilha: trilha.ultimoDia !== atual.trilha.ultimoDia,
  };
}

/**
 * Estado para leitura, já com o Fôlego regenerado.
 *
 * A tela precisa mostrar o Fôlego de agora, não o da última gravação. Como a
 * regeneração é calculada e não agendada (docs/08 §4), quem lê aplica a mesma
 * função que quem escreve — e por isso ela vive aqui, no domínio, e não numa
 * consulta que um dia divergiria.
 */
export function comoEstaAgora(
  estado: EstadoDeProgresso,
  agora: Date,
): EstadoDeProgresso {
  const regenerado = regenerar(estado.folego, estado.folegoAtualizadoEm, agora);
  return {
    ...estado,
    folego: regenerado.folego,
    folegoAtualizadoEm: regenerado.atualizadoEm,
  };
}
