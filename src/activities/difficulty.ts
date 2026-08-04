/**
 * DIFICULDADE
 *
 * Duas coisas diferentes com o mesmo nome, e confundi-las é a origem de metade
 * dos sistemas adaptativos ruins:
 *
 * 1. **Rótulo de autoria** (`FACIL`, `MEDIO`, `DIFICIL`, `ADAPTATIVO`) — o que
 *    quem escreve a atividade declara. É intenção humana, grosseira.
 * 2. **Dificuldade calibrada** (escala Elo, `Activity.difficulty`) — o que a
 *    telemetria descobriu. É medida, fina, e muda sozinha com o uso.
 *
 * O rótulo dá o ponto de partida; a calibração corrige. Um autor que jurou que
 * a atividade era "fácil" e 70% das crianças erram está enganado, e o sistema
 * precisa poder discordar dele sem esperar alguém reeditar o arquivo.
 *
 * docs/08 §1 e §2.
 */

/**
 * Rótulos declarados na autoria.
 *
 * Tupla `as const` e tipo derivado dela — e não o contrário — para que
 * `z.enum(DIFFICULTY_LABELS)` preserve os literais. Declarar a união à mão e a
 * lista à parte é como as duas saem de sincronia.
 */
export const DIFFICULTY_LABELS = ["FACIL", "MEDIO", "DIFICIL", "ADAPTATIVO"] as const;

export type DifficultyLabel = (typeof DIFFICULTY_LABELS)[number];

/**
 * Dificuldade inicial na escala Elo para cada rótulo.
 *
 * São apenas sementes. A partir de ~200 tentativas a calibração por telemetria
 * assume (docs/08 §2) e estes números deixam de importar para aquela atividade.
 * 1000 é o centro da escala: uma criança com habilidade 1000 acerta ~50% de uma
 * atividade de dificuldade 1000.
 */
export const DIFICULDADE_INICIAL: Readonly<Record<DifficultyLabel, number>> = {
  FACIL: 800,
  MEDIO: 1000,
  DIFICIL: 1200,
  /**
   * `ADAPTATIVO` não tem dificuldade própria: a atividade é escolhida em tempo
   * de execução para casar com a habilidade de quem joga. O valor aqui é só o
   * centro de busca inicial.
   */
  ADAPTATIVO: 1000,
};

/**
 * Fator que multiplica a recompensa conforme o desafio real (docs/08 §1).
 *
 * `clamp(0.6, 1.8, 1 + (dificuldade − habilidade) / 400)`
 *
 * O efeito é o que interessa: repetir conteúdo muito abaixo do nível rende
 * quase nada (0.6), e encarar o que está acima rende muito (até 1.8). Isso
 * remove o incentivo a "farmar" atividade fácil e alinha o que é divertido com
 * o que faz aprender — sem precisar proibir nada.
 */
export function fatorDeDificuldade(
  dificuldadeDaAtividade: number,
  habilidadeDaCrianca: number,
): number {
  const bruto = 1 + (dificuldadeDaAtividade - habilidadeDaCrianca) / 400;
  return Math.min(1.8, Math.max(0.6, bruto));
}

/**
 * Alvo de dificuldade para a seleção adaptativa (docs/08 §7.3).
 *
 * `habilidade + 60` mira ~80% de acerto esperado no modelo Elo. Não é 50%: a
 * zona de desenvolvimento produtiva é aquela em que a criança acerta a maioria
 * e tropeça um pouco. Mirar 50% produziria frustração constante.
 */
export function alvoDeDificuldade(habilidadeDaCrianca: number): number {
  return habilidadeDaCrianca + 60;
}

// ── Porta para a IA assumir depois ───────────────────────────────────────────

export interface PedidoDeSelecao {
  readonly habilidade: number;
  readonly objectiveId: string;
  /** Ids já vistos recentemente, para não repetir (docs/08 §7.2). */
  readonly excluir: readonly string[];
  /** Tipos usados nas últimas atividades, para variar a forma (docs/08 §7.4). */
  readonly tiposRecentes: readonly string[];
  readonly quantidade: number;
}

export interface CandidataAtividade {
  readonly activityId: string;
  readonly type: string;
  readonly dificuldade: number;
}

/**
 * Quem decide qual atividade vem agora.
 *
 * É uma **porta**, não uma implementação, exatamente porque a resposta de
 * docs/08 §7 (ordenar por proximidade do alvo) é a primeira versão, e a versão
 * seguinte é um modelo. Quando a IA assumir, troca-se a implementação no
 * composition root e nenhum caso de uso muda — o motor nunca soube como a
 * escolha era feita.
 */
export interface SeletorDeAtividades {
  selecionar(
    pedido: PedidoDeSelecao,
    candidatas: readonly CandidataAtividade[],
  ): readonly CandidataAtividade[];
}

/**
 * Implementação determinística de docs/08 §7: mais perto do alvo primeiro,
 * evitando repetir o mesmo tipo três vezes seguidas.
 *
 * Determinística de propósito — nada de `Math.random`. Variedade vem de
 * diversificar o tipo, não de sorteio: sorteio torna a sessão irreprodutível e
 * um bug de seleção impossível de investigar.
 */
export const seletorPorProximidade: SeletorDeAtividades = {
  selecionar(pedido, candidatas) {
    const alvo = alvoDeDificuldade(pedido.habilidade);
    const excluidas = new Set(pedido.excluir);

    const elegiveis = candidatas
      .filter((c) => !excluidas.has(c.activityId))
      .sort((a, b) => {
        const distancia = Math.abs(a.dificuldade - alvo) - Math.abs(b.dificuldade - alvo);
        // Desempate estável pelo id: duas atividades igualmente distantes
        // precisam sair sempre na mesma ordem, senão o teste vira loteria.
        return distancia !== 0 ? distancia : a.activityId.localeCompare(b.activityId);
      });

    const escolhidas: CandidataAtividade[] = [];
    const historicoDeTipos = [...pedido.tiposRecentes];

    for (const candidata of elegiveis) {
      if (escolhidas.length >= pedido.quantidade) break;

      const ultimosDois = historicoDeTipos.slice(-2);
      const repetiriaTresVezes =
        ultimosDois.length === 2 && ultimosDois.every((t) => t === candidata.type);
      if (repetiriaTresVezes) continue;

      escolhidas.push(candidata);
      historicoDeTipos.push(candidata.type);
    }

    // Se a regra de variedade não deixou preencher a sessão, é melhor repetir
    // o tipo do que entregar uma missão curta pela metade.
    if (escolhidas.length < pedido.quantidade) {
      for (const candidata of elegiveis) {
        if (escolhidas.length >= pedido.quantidade) break;
        if (!escolhidas.includes(candidata)) escolhidas.push(candidata);
      }
    }

    return escolhidas;
  },
};
