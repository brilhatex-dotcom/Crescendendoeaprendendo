import type { EvaluationContext, EvaluationResult } from "../../contracts";
import type { WordBuildAnswer, WordBuildConfig } from "./schema";

/**
 * Correção de montar-a-palavra. **Função pura.**
 *
 * Mesma ideia de crédito parcial de `ORDER_SEQUENCE` (maior subsequência
 * crescente sobre as posições do gabarito), com uma diferença: pedaços que não
 * pertencem à palavra (iscas) não têm posição no gabarito — são simplesmente
 * ignorados no cálculo de progresso, nunca tratados como resposta corrompida.
 * Tocar numa isca é um erro de conteúdo (letra parecida, sílaba de outra
 * palavra), não um erro de sistema.
 */
export function evaluateWordBuild(
  config: WordBuildConfig,
  answer: WordBuildAnswer,
  ctx: EvaluationContext,
): EvaluationResult {
  if (answer.sequencia.length === 0) {
    return { outcome: "SKIPPED", scoreRatio: 0 };
  }

  const idsDosPedacos = new Set(config.pedacos.map((p) => p.id));
  for (const id of answer.sequencia) {
    // Id fora do banco desta atividade: resposta corrompida. Orientar, sem culpar a criança.
    if (!idsDosPedacos.has(id)) {
      return {
        outcome: "INCORRECT",
        scoreRatio: 0,
        feedback: {
          tom: "ORIENTA",
          mensagem: "Não consegui ler sua resposta.",
          ensino: "Toque nos pedaços para montar a palavra e tente de novo.",
        },
      };
    }
  }

  const posicaoCorreta = new Map(config.sequenciaCorreta.map((id, i) => [id, i]));
  const total = config.sequenciaCorreta.length;

  const posicoes = answer.sequencia
    .map((id) => posicaoCorreta.get(id))
    .filter((posicao): posicao is number => posicao !== undefined);
  const letrasCertas = maiorSubsequenciaCrescente(posicoes);
  const scoreRatio = total > 0 ? letrasCertas / total : 0;

  const acertouTudo =
    answer.sequencia.length === total &&
    answer.sequencia.every((id, i) => config.sequenciaCorreta[i] === id);

  const detalhes = {
    sequenciaEnviada: answer.sequencia,
    letrasCertas,
    total,
    /** Posições que o renderer destaca como fora do lugar (isca ou ordem errada). */
    posicoesForaDeLugar: answer.sequencia
      .map((id, i) => (config.sequenciaCorreta[i] === id ? null : i))
      .filter((i): i is number => i !== null),
  };

  if (acertouTudo) {
    return {
      outcome: "CORRECT",
      scoreRatio: 1,
      feedback: { tom: "CELEBRA", mensagem: config.mensagemDeAcerto },
      detalhes,
    };
  }

  const alcancouParcial = scoreRatio >= config.limiarParcial;
  const dica = config.dicas[ctx.dicasUsadas];

  if (alcancouParcial) {
    return {
      outcome: "PARTIAL",
      scoreRatio,
      feedback: {
        tom: "QUASE",
        mensagem: `Você acertou ${letrasCertas} de ${total} letras.`,
        ensino: config.ensinoParcial ?? config.ensino,
        ...(dica ? { dica } : {}),
      },
      ...(config.equivoco ? { equivoco: config.equivoco } : {}),
      detalhes,
    };
  }

  return {
    outcome: "INCORRECT",
    scoreRatio,
    feedback: {
      tom: ctx.dicasUsadas === 0 ? "QUASE" : "ORIENTA",
      mensagem: "Ainda não é essa a palavra.",
      ensino: config.ensino,
      ...(dica ? { dica } : {}),
    },
    ...(config.equivoco ? { equivoco: config.equivoco } : {}),
    detalhes,
  };
}

/** Idêntica à de `ORDER_SEQUENCE` — mesma justificativa, mesma prova. */
function maiorSubsequenciaCrescente(valores: readonly number[]): number {
  const menoresCaudas: number[] = [];

  for (const valor of valores) {
    let inicio = 0;
    let fim = menoresCaudas.length;

    while (inicio < fim) {
      const meio = (inicio + fim) >> 1;
      if ((menoresCaudas[meio] ?? 0) < valor) inicio = meio + 1;
      else fim = meio;
    }

    menoresCaudas[inicio] = valor;
  }

  return menoresCaudas.length;
}

/**
 * Chutar a sequência certa é escolher, sem reposição, `n` pedaços do banco de
 * `p` na ordem certa: `1 / (p × (p−1) × … × (p−n+1))`. Sem iscas (`p === n`)
 * isso cai exatamente na fórmula de `ORDER_SEQUENCE`, `1/n!`; cada isca no
 * banco reduz ainda mais a chance de acerto por chute.
 */
export function probabilidadeDeChuteWordBuild(config: WordBuildConfig): number {
  const n = config.sequenciaCorreta.length;
  const p = config.pedacos.length;
  if (n < 1 || p < n) return 1;

  let denominador = 1;
  for (let i = 0; i < n; i += 1) denominador *= p - i;
  return 1 / denominador;
}
