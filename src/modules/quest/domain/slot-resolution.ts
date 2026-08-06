import type { AtividadeDaMissao, DadosDaMissao, SlotPendente } from "./quest-run";
import type { RegraDeSlot } from "./slot-rule";

/**
 * MESCLAR ATIVIDADE FIXA E SLOT RESOLVIDO NUMA SÓ SEQUÊNCIA JOGÁVEL.
 *
 * A parte pura da seleção adaptativa (docs/08 §7): agrupar o que precisa do
 * mesmo pedido de seleção, e juntar o resultado à missão sem que
 * `posicaoDaRetomada`, `missaoConcluida` e `atividadesRestantes` precisem
 * saber que um slot um dia existiu. Quem consulta banco e chama o seletor é
 * `application/resolve-slots.ts` — este arquivo não sabe o que é uma
 * transação.
 *
 * Arquivo puro.
 */

/** Chave estável de um slot — identifica a linha de `StageActivity` que ele preenche. */
export function chaveDoSlot(slot: { readonly stageId: string; readonly order: number }): string {
  return `${slot.stageId}:${slot.order}`;
}

const ORDEM_DE_FAIXA = ["SPROUT", "EXPLORER", "PIONEER", "VANGUARD"] as const;

function indiceDaFaixa(faixa: string): number {
  const indice = ORDEM_DE_FAIXA.indexOf(faixa as (typeof ORDEM_DE_FAIXA)[number]);
  // Faixa que não existe na lista (dado corrompido) não pode virar exceção no
  // meio de uma missão — trata como a mais nova, a leitura mais conservadora.
  return indice === -1 ? ORDEM_DE_FAIXA.length - 1 : indice;
}

/**
 * A criança pode jogar esta atividade? (docs/08 §7.1 — "faixa etária compatível").
 *
 * Comparação por índice, não pela string do enum: `AgeBand` é uma escala
 * ordenada (SPROUT < EXPLORER < PIONEER < VANGUARD), e o Postgres não sabe
 * disso — para ele são só rótulos.
 */
export function faixaCompativel(minima: string, maxima: string, daCrianca: string): boolean {
  const indice = indiceDaFaixa(daCrianca);
  return indice >= indiceDaFaixa(minima) && indice <= indiceDaFaixa(maxima);
}

export interface GrupoDeSlots {
  readonly regra: RegraDeSlot;
  readonly slots: readonly SlotPendente[];
}

/**
 * Agrupa slots pendentes pelo mesmo pedido de seleção — mesmo objetivo e
 * mesmo `difficultyDelta`. É o que permite ao seletor escolher o lote de uma
 * vez e aplicar a variedade de tipo entre eles (docs/08 §7.4), em vez de cada
 * slot repetir a mesma consulta de candidatas isoladamente.
 *
 * Slot com regra irreconhecível (`null`) não entra em grupo nenhum: já não há
 * objetivo para buscar candidata, e `mesclarAtividades` o descarta no fim.
 */
export function agruparSlotsPendentes(
  pendentes: readonly SlotPendente[],
): readonly GrupoDeSlots[] {
  const grupos = new Map<string, { regra: RegraDeSlot; slots: SlotPendente[] }>();

  for (const slot of pendentes) {
    if (!slot.regra) continue;

    const chave = `${slot.regra.objectiveId}:${slot.regra.difficultyDelta}`;
    const existente = grupos.get(chave);
    if (existente) {
      existente.slots.push(slot);
    } else {
      grupos.set(chave, { regra: slot.regra, slots: [slot] });
    }
  }

  return [...grupos.values()];
}

/**
 * Junta atividade fixa e slot resolvido numa sequência única, em ordem de fase.
 *
 * ── A decisão que define esta função ──
 * O slot resolvido entra ao **final da fase**, depois de toda atividade fixa
 * dela — nunca na posição declarada em `StageActivity.order`. Preservar a
 * posição exata exigiria carregar a ordem de cada atividade fixa também, hoje
 * descartada na leitura (`AtividadeDaMissao` não tem `order`), e nenhum
 * conteúdo intercala fixa e slot na mesma fase hoje. Revisitar aqui se isso
 * deixar de ser verdade.
 *
 * Slot sem resolução (regra irreconhecível ou nenhuma candidata encontrada)
 * some da missão — o mesmo destino de sempre para um slot sem `activityId`
 * conhecido (`prisma-quest-repository.ts` já descarta o que nunca teve dono).
 */
export function mesclarAtividades(
  missao: DadosDaMissao,
  resolvidos: ReadonlyMap<string, string>,
): readonly AtividadeDaMissao[] {
  if (missao.slotsPendentes.length === 0) return missao.atividades;

  const porFase = new Map<number, AtividadeDaMissao[]>();
  for (const atividade of missao.atividades) {
    const lista = porFase.get(atividade.fase) ?? [];
    lista.push(atividade);
    porFase.set(atividade.fase, lista);
  }

  const slotsEmOrdem = [...missao.slotsPendentes].sort((a, b) => a.order - b.order);
  for (const slot of slotsEmOrdem) {
    const activityId = resolvidos.get(chaveDoSlot(slot));
    if (!activityId) continue;

    const lista = porFase.get(slot.fase) ?? [];
    lista.push({ activityId, fase: slot.fase });
    porFase.set(slot.fase, lista);
  }

  return [...porFase.entries()]
    .sort(([faseA], [faseB]) => faseA - faseB)
    .flatMap(([, atividades]) => atividades);
}
