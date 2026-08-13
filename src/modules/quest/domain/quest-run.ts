import type { RegraDeSlot } from "./slot-rule";
import type { RegraDeDesbloqueio } from "./unlock-rule";

/**
 * A CORRIDA DE MISSÃO — uma jogada, do começo ao fim.
 *
 * `QuestRun` existe por uma razão só, e ela está no comentário do modelo em
 * `docs/04`: **fechar o app nunca pode custar progresso**. Uma criança de sete
 * anos é interrompida no meio de tudo — o jantar, a escola, a bateria. Se
 * voltar significasse recomeçar, ela pararia de começar.
 *
 * O que este arquivo decide, e o resto do sistema não precisa saber:
 * onde ela parou, se a missão acabou, e quanto vale o que ela fez.
 *
 * Arquivo puro.
 */

export type StatusDaCorrida = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface EstadoDaCorrida {
  readonly id: string;
  readonly learnerId: string;
  readonly questId: string;
  readonly status: StatusDaCorrida;
  /** Fase em que ela está — derivada das atividades já respondidas. */
  readonly faseAtual: number;
  readonly pontuacao: number;
  readonly iniciadaEm: Date;
  readonly concluidaEm: Date | null;
  /**
   * Marca de recompensa concedida (Bíblia Cap. 6 §6.5).
   *
   * É o que impede a recompensa de missão de sair duas vezes — e a defesa é
   * necessária porque concluir é a única operação do jogo que uma criança pode
   * disparar duas vezes sem querer, batendo no botão.
   */
  readonly recompensaConcedidaEm: Date | null;
}

/** O prêmio declarado na missão, lido do banco. Nunca calculado aqui. */
export interface PremioDaMissao {
  readonly xp: number;
  readonly moedas: number;
  readonly cristais: number;
  /** `code` de `Collectible` — o motor só concede o código (docs/08 §6). */
  readonly colecionaveis: readonly string[];
}

export interface DadosDaMissao {
  readonly questId: string;
  readonly tipo: string;
  readonly nome: string;
  readonly premio: PremioDaMissao;
  /** Competências que um Colosso cobra. Entra na regra efetiva (docs/08 §3). */
  readonly competenciasExigidas: readonly string[];
  /** Regra declarada no conteúdo. `null` quando a missão não tranca nada. */
  readonly desbloqueio: RegraDeDesbloqueio | null;
  /**
   * Atividades da missão, em ordem de fase e posição.
   *
   * Vem do banco (`StageActivity`), não do arquivo em disco: é sobre estas
   * linhas que `Attempt` aponta, e é contra elas que a conclusão é verificada.
   */
  readonly atividades: readonly AtividadeDaMissao[];
  /**
   * Slots dinâmicos (`StageActivity.activityId` nulo) ainda sem atividade
   * escolhida. Vazio em toda missão que só tem atividade fixa — hoje, todas.
   * Quem preenche é `resolverSlotsDaMissao` (docs/08 §7), nunca este arquivo:
   * arquivo puro não consulta o banco para saber a habilidade da criança.
   */
  readonly slotsPendentes: readonly SlotPendente[];
}

export interface AtividadeDaMissao {
  readonly activityId: string;
  /** Índice da fase, começando em 0. */
  readonly fase: number;
}

export interface SlotPendente {
  readonly stageId: string;
  /** `StageActivity.order` — usado só para ordenar slots entre si (docs/13 nota de mesclagem). */
  readonly order: number;
  readonly fase: number;
  /** `null` quando a regra em `slotRule` é irreconhecível — o slot nunca será preenchido. */
  readonly regra: RegraDeSlot | null;
}

/**
 * Onde a criança parou.
 *
 * Derivado das tentativas, e não de uma coluna de posição — de propósito. Uma
 * coluna de posição pode divergir do que realmente aconteceu (uma escrita
 * perdida, uma correção manual, um defeito antigo) e aí a criança volta para o
 * lugar errado. As tentativas são o registro do que ela de fato fez; contar a
 * partir delas não tem como estar errado.
 */
export function posicaoDaRetomada(
  missao: DadosDaMissao,
  respondidas: ReadonlySet<string>,
): { readonly indice: number; readonly fase: number } {
  for (let i = 0; i < missao.atividades.length; i += 1) {
    const atividade = missao.atividades[i];
    if (atividade && !respondidas.has(atividade.activityId)) {
      return { indice: i, fase: atividade.fase };
    }
  }

  // Todas respondidas: a posição é o fim.
  const ultima = missao.atividades[missao.atividades.length - 1];
  return { indice: missao.atividades.length, fase: ultima?.fase ?? 0 };
}

/**
 * A missão acabou?
 *
 * **Toda atividade precisa ter sido respondida** — não acertada. "Seguir em
 * frente" é sempre possível no executor (travar a criança numa atividade que
 * ela não consegue é o oposto de ensinar), então exigir acerto tornaria a
 * missão impossível de terminar justamente para quem mais precisa terminá-la.
 *
 * O que esta função **não** aceita é a palavra do cliente. Quem diz que a
 * missão acabou é a contagem de tentativas gravadas; sem isso, um toque forjado
 * concederia `Quest.rewardXp` sem nenhuma resposta.
 */
export function missaoConcluida(
  missao: DadosDaMissao,
  respondidas: ReadonlySet<string>,
): boolean {
  if (missao.atividades.length === 0) return false;
  return missao.atividades.every((a) => respondidas.has(a.activityId));
}

/** Quanto falta, para a tela poder dizer em vez de só travar o botão. */
export function atividadesRestantes(
  missao: DadosDaMissao,
  respondidas: ReadonlySet<string>,
): number {
  return missao.atividades.filter((a) => !respondidas.has(a.activityId)).length;
}
