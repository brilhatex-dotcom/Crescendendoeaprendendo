import { z } from "zod";

/**
 * CRITÉRIO DE CONQUISTA — regra declarativa avaliada por evento.
 *
 * `Achievement.criteria` é `Json` no banco (docs/HANDOFF.md §5, item 3). Ao
 * contrário de `unlock-rule.ts` — que responde "dá para jogar **agora**?" a
 * partir do estado corrente — uma conquista acumula ao longo do tempo, então
 * o critério aqui não é uma condição pontual: é "quantas vezes isto
 * aconteceu, e quanto basta".
 *
 * Só dois tipos por enquanto, e de propósito: são os únicos que dá para
 * avaliar **recomputando de uma fonte de verdade já persistida**, sem
 * inventar contador novo nem tabela de deduplicação —
 * `SkillMastery.masteredAt` e `QuestRun.status`. Isso é o que faz o avanço de
 * progresso idempotente de graça (ver `RepositorioDeConquistas.avancarProgresso`,
 * `application/ports.ts`): reprocessar o mesmo evento duas vezes (o outbox é
 * *at-least-once*, nunca *exactly-once*) dá o mesmo resultado, porque não é
 * "some 1", é "conte de novo quantos já são".
 *
 * As cinco famílias do produto são `DOMINIO`, `PERSISTENCIA`, `DESCOBERTA`,
 * `CRIACAO` e `CUIDADO` (Bíblia Vol. 1 Cap. 6 §6.15). Só as duas primeiras
 * têm mecânica hoje — Descoberta, Criação e Cuidado exigem eventos que o
 * motor ainda não publica (segredo encontrado, obra criada, ajuda a
 * personagem). Ver `docs/HANDOFF.md` para o registro dessa decisão.
 *
 * Arquivo puro.
 */

export const TIPOS_DE_CRITERIO = ["competenciasDominadas", "missoesConcluidas"] as const;
export type TipoDeCriterio = (typeof TIPOS_DE_CRITERIO)[number];

export interface CriterioDeConquista {
  readonly tipo: TipoDeCriterio;
  /** Quantas ocorrências completam a conquista. */
  readonly minimo: number;
}

export const criterioDeConquistaSchema: z.ZodType<CriterioDeConquista> = z.object({
  tipo: z.enum(TIPOS_DE_CRITERIO),
  minimo: z.number().int().min(1),
});

/**
 * Progresso (0–1) a partir da contagem recomputada e do mínimo exigido.
 * `Math.min` garante que um recount acima do mínimo (ex.: a criança já tinha
 * ultrapassado antes de o catálogo declarar essa conquista) não estoure 1.
 */
export function progressoDoCriterio(contagemAtual: number, criterio: CriterioDeConquista): number {
  return Math.min(1, contagemAtual / criterio.minimo);
}

export function foiAlcancado(progresso: number): boolean {
  return progresso >= 1;
}
