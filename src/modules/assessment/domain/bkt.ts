/**
 * BKT — Bayesian Knowledge Tracing (docs/08 §2).
 *
 * Responde a uma pergunta só: **qual a probabilidade de esta criança já dominar
 * esta competência?** Não é a taxa de acerto. Taxa de acerto confunde "acertou
 * porque sabe" com "acertou porque chutou entre quatro opções" — e é por isso
 * que um sistema baseado em porcentagem acaba parabenizando quem não aprendeu.
 *
 * O modelo tem quatro parâmetros e todos vêm de docs/08 §2:
 *
 *   P(L0)   = 0.15  o que se acredita antes de qualquer evidência
 *   P(T)    = 0.12  chance de aprender *durante* a tentativa
 *   P(slip) = 0.10  sabia e errou (distração, pressa, toque errado)
 *   P(guess)        acertou sem saber — **vem do plugin**, não daqui, porque
 *                   depende da atividade: 4 opções é 0.25, resposta construída
 *                   é 0.02. Um valor fixo por tipo superestimaria o aprendizado
 *                   justamente onde é mais fácil chutar.
 *
 * Arquivo puro: sem relógio, sem banco, sem aleatoriedade. Todo o comportamento
 * abaixo é testável com aritmética.
 */

/** Parâmetros de docs/08 §2. Mudá-los muda o significado de "dominou". */
export const BKT = {
  /** P(L0) — crença inicial. */
  prior: 0.15,
  /** P(T) — transição de não-saber para saber a cada oportunidade. */
  transicao: 0.12,
  /** P(slip) — sabia e escorregou. */
  escorregao: 0.1,
  /** Esquecimento por dia sem prática. */
  esquecimentoDiario: 0.02,
  /** Quem já dominou nunca cai abaixo disto: não se "desaprende" do zero. */
  pisoDoDominado: 0.5,
  /** Limiar de domínio. Uma das três condições — nunca sozinho. */
  limiarDeDominio: 0.85,
  /** Tentativas mínimas antes de declarar domínio. */
  tentativasMinimas: 3,
  /** Acertos seguidos mínimos, em atividade no nível de referência ou acima. */
  acertosSeguidosMinimos: 2,
} as const;

/**
 * Limites numéricos.
 *
 * `probabilidade` nunca chega a 0 nem a 1: um zero absoluto tornaria a evidência
 * seguinte incapaz de mover a crença (0 × qualquer coisa = 0), e o modelo
 * ficaria travado para sempre. `chute` também é limitado — um plugin que
 * declarasse 0 ou 1 zeraria denominador.
 */
const PROBABILIDADE_MINIMA = 0.0001;
const PROBABILIDADE_MAXIMA = 0.9999;
const CHUTE_MINIMO = 0.01;
const CHUTE_MAXIMO = 0.95;

export const limitar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor));

/** Arredonda para caber na coluna sem que memória e banco divirjam. */
export const arredondar = (valor: number, casas: number): number => {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
};

/**
 * Aplica esquecimento pelo tempo sem prática.
 *
 * Duas garantias que a fórmula sozinha não dá:
 *  · nunca **aumenta** a crença — esquecer não ensina;
 *  · nunca desce abaixo do piso, e se já estava abaixo dele, fica onde está
 *    (o piso protege quem dominou, não promove quem não dominou).
 */
export function esquecer(
  probabilidade: number,
  diasSemPratica: number,
  jaDominou: boolean,
): number {
  if (diasSemPratica <= 0) return probabilidade;

  const piso = Math.min(probabilidade, jaDominou ? BKT.pisoDoDominado : BKT.prior);
  const decaida = probabilidade * (1 - BKT.esquecimentoDiario) ** diasSemPratica;

  return Math.max(piso, decaida);
}

/** P(sabe | acertou) — Bayes com escorregão e chute. */
export function posteriorDeAcerto(probabilidade: number, chute: number): number {
  const sabendo = probabilidade * (1 - BKT.escorregao);
  return sabendo / (sabendo + (1 - probabilidade) * chute);
}

/** P(sabe | errou). */
export function posteriorDeErro(probabilidade: number, chute: number): number {
  const sabendo = probabilidade * BKT.escorregao;
  return sabendo / (sabendo + (1 - probabilidade) * (1 - chute));
}

/**
 * Um passo do modelo: observa a tentativa e devolve a nova crença.
 *
 * ── Sobre acerto parcial ──
 * O BKT clássico só conhece acertou/errou, e o motor produz `scoreRatio` em
 * 0..1 (ordenar 3 de 4 itens é 0.75). Descartar essa informação — tratando
 * tudo abaixo de 1 como erro — jogaria fora justamente o sinal mais rico que
 * temos, e puniria quem chegou perto.
 *
 * A saída aqui é a esperança sobre os dois posteriores, ponderada pela razão de
 * acerto. Com `scoreRatio` 0 ou 1 o resultado é exatamente o BKT clássico; no
 * meio, interpola. Isso é o que `scoreRatio` significa: a chance de o próximo
 * item daquela atividade sair certo.
 */
export function atualizarProbabilidade(entrada: {
  readonly probabilidade: number;
  readonly scoreRatio: number;
  readonly chute: number;
}): number {
  const p = limitar(entrada.probabilidade, PROBABILIDADE_MINIMA, PROBABILIDADE_MAXIMA);
  const chute = limitar(entrada.chute, CHUTE_MINIMO, CHUTE_MAXIMO);
  const razao = limitar(entrada.scoreRatio, 0, 1);

  const posterior =
    razao * posteriorDeAcerto(p, chute) + (1 - razao) * posteriorDeErro(p, chute);

  // Aprender durante a tentativa: mesmo errando, a criança leu o ensino.
  const comAprendizado = posterior + (1 - posterior) * BKT.transicao;

  return arredondar(
    limitar(comAprendizado, PROBABILIDADE_MINIMA, PROBABILIDADE_MAXIMA),
    4, // SkillMastery.probability é Decimal(5,4)
  );
}
