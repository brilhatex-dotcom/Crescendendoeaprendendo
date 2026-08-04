/**
 * FÔLEGO (docs/08 §4) — a regra mais fácil de trair sem perceber.
 *
 * O Fôlego existe para **ritmar sessões saudáveis e valorizar variedade**. Não
 * existe para extrair tempo, e muito menos dinheiro. Três invariantes o
 * protegem, e as três estão codificadas aqui ou em teste de política:
 *
 *  1. **Fôlego zerado nunca impede jogar.** A missão continua disponível; o que
 *     para é a recompensa cosmética e a moeda. XP e domínio contam integrais —
 *     isso vive em `calcularPremio`, no motor, e não numa checagem de tela que
 *     alguém esqueceria numa página nova.
 *  2. **Regenera sozinho**, 1 a cada 6 minutos, calculado por diferença de
 *     tempo. Sem job: um job que falhasse deixaria crianças sem Fôlego sem que
 *     ninguém percebesse, e o custo de errar aqui recai sobre elas.
 *  3. **Não é vendável por dinheiro real**, em nenhuma hipótese.
 *
 * Arquivo puro: o "agora" entra por parâmetro.
 */

export const FOLEGO = {
  maximo: 100,
  /** Um ponto a cada 6 minutos → 100 em 10 horas. */
  minutosPorPonto: 6,
} as const;

const MS_POR_MINUTO = 60_000;

/**
 * Fôlego atual, regenerado pelo tempo decorrido.
 *
 * Devolve também o instante a gravar em `energyUpdatedAt`. Não é o `agora`: é o
 * momento correspondente aos pontos **efetivamente creditados**. Gravar o agora
 * jogaria fora a fração de minuto que ainda não completou um ponto — e uma
 * criança que abrisse o app a cada cinco minutos nunca regeneraria nada.
 */
export function regenerar(
  atual: number,
  atualizadoEm: Date,
  agora: Date,
): { readonly folego: number; readonly atualizadoEm: Date } {
  if (atual >= FOLEGO.maximo) {
    // Já cheio: o relógio anda junto, senão o tempo parado viraria crédito
    // instantâneo no momento em que ela gastasse o primeiro ponto.
    return { folego: FOLEGO.maximo, atualizadoEm: agora };
  }

  const minutos = Math.max(0, (agora.getTime() - atualizadoEm.getTime()) / MS_POR_MINUTO);
  const ganhos = Math.floor(minutos / FOLEGO.minutosPorPonto);

  if (ganhos <= 0) return { folego: atual, atualizadoEm };

  const folego = Math.min(FOLEGO.maximo, atual + ganhos);
  const creditados = folego - atual;

  return {
    folego,
    atualizadoEm: new Date(
      atualizadoEm.getTime() + creditados * FOLEGO.minutosPorPonto * MS_POR_MINUTO,
    ),
  };
}

/**
 * Devolve Fôlego — o prêmio de uma atividade pode conceder (`premio.folego`).
 *
 * Só existe a versão que dá. **Não há função de gastar neste arquivo**, e a
 * ausência é deliberada: o gasto acontece ao iniciar uma missão, é decisão do
 * módulo de missão, e nunca de uma resposta. Uma criança nunca perde Fôlego por
 * responder — nem por errar.
 */
export const devolver = (atual: number, quantidade: number): number =>
  Math.min(FOLEGO.maximo, atual + Math.max(0, quantidade));
