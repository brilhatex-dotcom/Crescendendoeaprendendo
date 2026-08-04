import { BKT, atualizarProbabilidade, esquecer } from "./bkt";
import { ELO, atualizarHabilidade } from "./elo";
import { diasEntre } from "./spaced-repetition";

/**
 * DOMÍNIO DE COMPETÊNCIA — a junção do BKT com o Elo (docs/08 §2).
 *
 * Os dois modelos medem coisas diferentes e nenhum dos dois sozinho decide
 * nada. Quem decide é este arquivo, e a decisão que importa é uma só:
 * **quando declarar que a criança dominou a competência.**
 *
 * As três condições de docs/08 §2 existem para tornar o falso domínio caro:
 *
 *   P(L) ≥ 0.85            o modelo acredita
 *   ≥ 3 tentativas         houve evidência suficiente
 *   ≥ 2 acertos seguidos   e em atividade no nível de referência ou acima
 *
 * A terceira é a que costuma faltar nos sistemas parecidos, e é a mais
 * importante: sem ela, dez acertos em atividades fáceis viram "dominou", a
 * criança é promovida para conteúdo que não sustenta, e a culpa recai sobre
 * ela. A dificuldade de referência da competência é o piso da prova.
 */
export interface EstadoDeDominio {
  /** P(L) — crença de que domina. */
  readonly probabilidade: number;
  /** Habilidade na escala Elo. */
  readonly habilidade: number;
  readonly tentativas: number;
  readonly acertos: number;
  /** Acertos seguidos **em atividade no nível de referência ou acima**. */
  readonly sequencia: number;
  readonly dominadaEm: Date | null;
  readonly ultimaTentativaEm: Date | null;
  /**
   * Contador de atualização condicional (docs/08 §11).
   *
   * `SkillMastery` é linha quente: duas abas abertas na mesma missão gravam a
   * mesma chave. Sem isto, a segunda escrita sobrescreveria a primeira e uma
   * tentativa sumiria do modelo sem sumir da tabela `Attempt` — divergência
   * silenciosa, do tipo que só aparece num relatório errado meses depois.
   */
  readonly versao: number;
}

/**
 * Estado de quem nunca tentou esta competência.
 *
 * Habilidade parte do centro da escala, não da dificuldade da competência: o
 * que se desconhece é onde a *criança* está, e o centro é a única resposta
 * honesta antes da primeira evidência.
 */
export const dominioInicial = (): EstadoDeDominio => ({
  probabilidade: BKT.prior,
  habilidade: ELO.centro,
  tentativas: 0,
  acertos: 0,
  sequencia: 0,
  dominadaEm: null,
  ultimaTentativaEm: null,
  versao: 0,
});

export interface EvidenciaDeTentativa {
  /** Só `CORRECT` conta como acerto. Parcial move o modelo, mas não a sequência. */
  readonly acertou: boolean;
  readonly scoreRatio: number;
  /** P(guess) da atividade — vem do plugin (`probabilidadeDeChute`). */
  readonly probabilidadeDeChute: number;
  /** Dificuldade calibrada da atividade, escala Elo. */
  readonly dificuldadeDaAtividade: number;
  /** `Skill.difficultyRef` — o nível que serve de prova de domínio. */
  readonly dificuldadeDeReferencia: number;
  readonly agora: Date;
}

/**
 * Um passo do modelo de domínio.
 *
 * Ordem importa: **esquece primeiro, aprende depois**. O tempo parado desde a
 * última tentativa já passou quando a criança responde; aplicar o esquecimento
 * depois da evidência descontaria justamente o que acabou de ser demonstrado.
 */
export function evoluirDominio(
  atual: EstadoDeDominio,
  evidencia: EvidenciaDeTentativa,
): EstadoDeDominio {
  const antes = esquecer(
    atual.probabilidade,
    diasEntre(atual.ultimaTentativaEm, evidencia.agora),
    atual.dominadaEm !== null,
  );

  const probabilidade = atualizarProbabilidade({
    probabilidade: antes,
    scoreRatio: evidencia.scoreRatio,
    chute: evidencia.probabilidadeDeChute,
  });

  const habilidade = atualizarHabilidade({
    habilidade: atual.habilidade,
    dificuldade: evidencia.dificuldadeDaAtividade,
    scoreRatio: evidencia.scoreRatio,
    tentativasAnteriores: atual.tentativas,
  });

  const tentativas = atual.tentativas + 1;
  const acertos = atual.acertos + (evidencia.acertou ? 1 : 0);
  const sequencia = proximaSequencia(atual.sequencia, evidencia);

  return {
    probabilidade,
    habilidade,
    tentativas,
    acertos,
    sequencia,
    /*
     * Domínio é marco, não estado corrente: uma vez alcançado, não se perde.
     * Quem decai é a probabilidade (com piso de 0.5), e é ela que decide se a
     * competência volta para a fila de revisão. Rebaixar a criança seria
     * regressão — proibida em docs/08 §1 pelo mesmo motivo que a perda de XP.
     */
    dominadaEm:
      atual.dominadaEm ??
      (atingiuDominio({ probabilidade, tentativas, sequencia }) ? evidencia.agora : null),
    ultimaTentativaEm: evidencia.agora,
    versao: atual.versao + 1,
  };
}

/**
 * Acertos seguidos, contando só o que serve de prova.
 *
 * - Errar zera. É o que a palavra "seguidos" quer dizer.
 * - Acertar **abaixo** da dificuldade de referência mantém — não conta a favor,
 *   mas também não pune: praticar o que já se sabe é legítimo, só não é prova.
 * - Acertar no nível de referência ou acima incrementa.
 */
function proximaSequencia(atual: number, evidencia: EvidenciaDeTentativa): number {
  if (!evidencia.acertou) return 0;
  return evidencia.dificuldadeDaAtividade >= evidencia.dificuldadeDeReferencia
    ? atual + 1
    : atual;
}

/** As três condições de docs/08 §2, juntas e em um lugar só. */
export function atingiuDominio(estado: {
  readonly probabilidade: number;
  readonly tentativas: number;
  readonly sequencia: number;
}): boolean {
  return (
    estado.probabilidade >= BKT.limiarDeDominio &&
    estado.tentativas >= BKT.tentativasMinimas &&
    estado.sequencia >= BKT.acertosSeguidosMinimos
  );
}
