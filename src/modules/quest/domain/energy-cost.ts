/**
 * CUSTO DE FÔLEGO PARA INICIAR UMA MISSÃO (docs/08 §4).
 *
 * O Fôlego existe para ritmar sessões saudáveis e valorizar variedade. **Não**
 * existe para extrair tempo nem dinheiro, e é por isso que o custo é cobrado
 * aqui — ao *iniciar* — e em nenhum outro lugar. Responder nunca custa, errar
 * nunca custa, e ficar sem Fôlego não impede jogar: apenas corta o cosmético e
 * a moeda, enquanto Luz e domínio continuam integrais.
 *
 * Arquivo puro.
 */

/** Espelha `QuestKind` do banco. */
export const TIPOS_DE_MISSAO = [
  "STORY",
  "PRACTICE",
  "CHALLENGE",
  "BOSS",
  "REVIEW",
  "PROJECT",
  "FAMILY",
  "DAILY",
] as const;

export type TipoDeMissao = (typeof TIPOS_DE_MISSAO)[number];

/**
 * Tabela de docs/08 §4: 5 na campanha, 3 na revisão, 0 no resto.
 *
 * Os zeros não são generosidade solta — cada um responde a uma regra:
 *
 *  · `PROJECT` — trabalho criativo, que a criança faz porque quer. Cobrar por
 *    ele ensinaria que criar é caro.
 *  · `FAMILY` — a missão que ela faz com um adulto. Cobrar transformaria um
 *    momento entre os dois num recurso a administrar.
 *  · `DAILY` — acontece uma vez por dia. Gatear seria punir quem apareceu.
 */
export const CUSTO_DE_FOLEGO: Readonly<Record<TipoDeMissao, number>> = {
  STORY: 5,
  PRACTICE: 5,
  CHALLENGE: 5,
  BOSS: 5,
  REVIEW: 3,
  PROJECT: 0,
  FAMILY: 0,
  DAILY: 0,
};

/**
 * Custo de iniciar. Tipo desconhecido não cobra.
 *
 * O padrão é zero, e não o custo de campanha, porque a direção do erro importa:
 * um tipo novo que ninguém mapeou aqui deve sair de graça até alguém decidir o
 * preço. O contrário cobraria Fôlego de uma criança por um descuido nosso.
 *
 * `docs/08 §4` isenta também missão da escola e conteúdo novo da trilha
 * recomendada. As duas dependem de `Assignment` e do módulo de recomendação,
 * que ainda não existem — quando existirem, entram como isenção aqui, não como
 * exceção espalhada por quem chama.
 */
export function custoDeFolego(tipo: string): number {
  return CUSTO_DE_FOLEGO[tipo as TipoDeMissao] ?? 0;
}
