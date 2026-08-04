import type { EvaluationContext, EvaluationResult } from "../../contracts";
import type { OrderSequenceAnswer, OrderSequenceConfig } from "./schema";

/**
 * Correção de ordenação. **Função pura.**
 *
 * ── A decisão que define este plugin ──
 * Como medir "quase certo" numa sequência? A escolha ingênua é contar quantos
 * itens caíram na posição exata. Ela é ruim: uma criança que ordenou tudo certo
 * mas esqueceu um item no começo desloca todos os outros e tira zero — apesar
 * de ter entendido a ordem quase inteira.
 *
 * Usamos **maior subsequência crescente** sobre as posições do gabarito, que
 * mede o quanto da ordem *relativa* está certa. No exemplo acima ela dá quase
 * 100%, que é o que a criança de fato demonstrou saber.
 */
export function evaluateOrderSequence(
  config: OrderSequenceConfig,
  answer: OrderSequenceAnswer,
  ctx: EvaluationContext,
): EvaluationResult {
  if (answer.ordem.length === 0) {
    return { outcome: "SKIPPED", scoreRatio: 0 };
  }

  const posicaoCorreta = new Map(config.ordemCorreta.map((id, i) => [id, i]));
  const posicoes: number[] = [];

  for (const id of answer.ordem) {
    const posicao = posicaoCorreta.get(id);
    // Id desconhecido: resposta corrompida. Orientar, sem culpar a criança.
    if (posicao === undefined) {
      return {
        outcome: "INCORRECT",
        scoreRatio: 0,
        feedback: {
          tom: "ORIENTA",
          mensagem: "Não consegui ler sua resposta.",
          ensino: "Arraste os itens para montar a ordem e tente de novo.",
        },
      };
    }
    posicoes.push(posicao);
  }

  const total = config.ordemCorreta.length;
  const respondeuTudo = answer.ordem.length === total;
  const emOrdem = maiorSubsequenciaCrescente(posicoes);
  const scoreRatio = total > 0 ? emOrdem / total : 0;
  const acertouTudo = respondeuTudo && emOrdem === total;

  const detalhes = {
    ordemEnviada: answer.ordem,
    itensEmOrdem: emOrdem,
    total,
    /** Posições que o renderer destaca como fora do lugar. */
    posicoesForaDeLugar: answer.ordem
      .map((id, i) => (posicaoCorreta.get(id) === i ? null : i))
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

  /**
   * `PARTIAL` não é consolo: ele vale pontuação proporcional e alimenta o
   * modelo de domínio como acerto parcial. Por isso o limiar existe — sem ele,
   * qualquer ordem aleatória viraria "quase lá", e o elogio perderia sentido
   * justamente para quem chegou perto de verdade.
   */
  if (alcancouParcial) {
    return {
      outcome: "PARTIAL",
      scoreRatio,
      feedback: {
        tom: "QUASE",
        mensagem: `Você acertou ${emOrdem} de ${total} na ordem certa.`,
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
      mensagem: "Ainda não é essa a ordem.",
      ensino: config.ensino,
      ...(dica ? { dica } : {}),
    },
    ...(config.equivoco ? { equivoco: config.equivoco } : {}),
    detalhes,
  };
}

/**
 * Maior subsequência crescente — quantos itens estão em ordem relativa correta.
 *
 * O(n log n) por busca binária. Com no máximo 10 itens isso é irrelevante para
 * a performance; o motivo de usar a versão boa é outra: ela é a formulação
 * clássica, fácil de conferir contra a literatura, e este é código que corrige
 * o trabalho de uma criança — errar aqui é injustiça silenciosa.
 */
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
 * Chutar a ordem exata de n itens é 1/n!. Para 3 itens já é 0.17; para 5, 0.008.
 *
 * Diferente da múltipla escolha, aqui o chute é praticamente impossível a
 * partir de 4 itens — e é isso que o BKT precisa saber para creditar o acerto
 * como aprendizado de verdade.
 */
export function probabilidadeDeChuteOrderSequence(
  config: OrderSequenceConfig,
): number {
  const n = config.ordemCorreta.length;
  if (n < 2) return 1;

  let fatorial = 1;
  for (let i = 2; i <= n; i += 1) fatorial *= i;
  return 1 / fatorial;
}
