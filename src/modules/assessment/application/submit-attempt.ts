import type { EvaluationResult, Premio, RegraDeRecompensa } from "@/activities";
import { ConflitoDeConcorrencia, conflict, err, notFound, ok, type Result } from "@/shared/kernel";

import { planejarTentativa } from "../domain/attempt-plan";
import { TentativaJaRegistrada, type AssessmentDeps } from "./ports";

/**
 * `submitAttempt` — a resposta de uma criança vira histórico, modelo e evento.
 *
 * É a primeira ação do sistema com efeito econômico, e por isso a primeira a
 * exigir `idempotencyKey` (docs/09 §4, passo 5). A chave não é detalhe de
 * transporte: sem ela, um toque duplo, uma reconexão de rede ou o sync de uma
 * sessão offline creditariam a mesma tentativa duas vezes — e o dano seria
 * invisível, porque tudo pareceria certo em cada requisição isolada.
 *
 * O que este caso de uso **não** faz: creditar XP, mexer em carteira, gastar
 * Fôlego, conceder conquista, fechar missão. Tudo isso sai pelo evento
 * `assessment.attempt_evaluated`, gravado na mesma transação (docs/08 §11).
 */

export interface SubmeterTentativaEntrada {
  readonly learnerId: string;
  /** `Activity.sourceRef` — ver `PedidoDeContexto`. */
  readonly refDaAtividade: string;

  /**
   * O resultado já corrigido pelo motor.
   *
   * A correção acontece na camada de apresentação porque é lá que o conteúdo
   * autorado está carregado, e é a mesma função pura que roda no navegador.
   * Assessment recebe o veredito e mede o que ele significa — dois trabalhos
   * diferentes, e juntá-los faria o módulo depender do acervo em disco.
   */
  readonly resultado: EvaluationResult;
  /** P(guess) da atividade, do plugin. Entra no BKT. */
  readonly probabilidadeDeChute: number;
  readonly regraDeRecompensa: RegraDeRecompensa | null;

  /** A resposta crua, para o histórico. Nunca é reinterpretada aqui. */
  readonly resposta: unknown;
  readonly dicasUsadas: number;
  readonly duracaoMs: number;
  readonly questRunId: string | null;
  readonly idempotencyKey: string;
  readonly avaliadaNoCliente: boolean;
  readonly traceId: string;
}

export interface SubmeterTentativaSaida {
  /**
   * Prêmio calculado nesta tentativa. `null` quando a atividade não tem regra
   * de recompensa **ou** quando a tentativa era repetida — em ambos os casos
   * nada foi concedido, e mostrar um número seria mentir para a criança.
   */
  readonly premio: Premio | null;
  /** `true` quando a chave já tinha sido registrada. Nada foi escrito de novo. */
  readonly repetida: boolean;
  readonly dominio: {
    readonly probabilidade: number;
    readonly habilidade: number;
    readonly dominouAgora: boolean;
  } | null;
  readonly proximaRevisaoEm: Date | null;
  /** Número desta tentativa nesta atividade, começando em 1. */
  readonly numeroDaTentativa: number;
}

export type SubmeterTentativa = (
  entrada: SubmeterTentativaEntrada,
) => Promise<Result<SubmeterTentativaSaida>>;

/**
 * Backoff entre releituras quando outra escrita ganhou a corrida.
 *
 * Três tentativas, como manda docs/08 §11. Os intervalos são curtos de
 * propósito: quem está do outro lado é uma criança esperando a devolutiva de
 * uma resposta, e meio segundo de espera já é tempo demais nessa idade.
 */
const ESPERAS_MS = [15, 45] as const;
const MAXIMO_DE_TENTATIVAS = ESPERAS_MS.length + 1;

const REPETIDA: SubmeterTentativaSaida = {
  premio: null,
  repetida: true,
  dominio: null,
  proximaRevisaoEm: null,
  numeroDaTentativa: 0,
};

export function criarSubmeterTentativa(deps: AssessmentDeps): SubmeterTentativa {
  return async function submeterTentativa(entrada) {
    /*
     * Consulta de idempotência antes de qualquer leitura pesada.
     *
     * Ela não substitui a restrição `@unique` de `Attempt.idempotencyKey` —
     * duas requisições simultâneas passariam as duas por aqui. É o índice que
     * garante; esta consulta só evita o trabalho no caso comum, que é o retry
     * chegando segundos depois.
     */
    if (await deps.repositorio.jaRegistrada(entrada.idempotencyKey)) {
      return ok(REPETIDA);
    }

    for (let rodada = 0; rodada < MAXIMO_DE_TENTATIVAS; rodada += 1) {
      const contexto = await deps.repositorio.carregarContexto({
        learnerId: entrada.learnerId,
        refDaAtividade: entrada.refDaAtividade,
      });

      if (!contexto) {
        return err(
          notFound(
            "assessment.activity_not_published",
            "Esta atividade ainda não está publicada no banco. Rode a importação do acervo.",
          ),
        );
      }

      const plano = planejarTentativa(contexto, {
        resultado: entrada.resultado,
        probabilidadeDeChute: entrada.probabilidadeDeChute,
        regraDeRecompensa: entrada.regraDeRecompensa,
        resposta: entrada.resposta,
        dicasUsadas: entrada.dicasUsadas,
        duracaoMs: entrada.duracaoMs,
        questRunId: entrada.questRunId,
        idempotencyKey: entrada.idempotencyKey,
        avaliadaNoCliente: entrada.avaliadaNoCliente,
        traceId: entrada.traceId,
        agora: deps.clock.now(),
      });

      try {
        /*
         * Uma transação para tudo que docs/08 §11 exige atômico: a tentativa, o
         * modelo de domínio, a revisão — e, através do barramento, a Luz, o
         * Fôlego e a carteira, escritos pelos módulos que reagem ao evento sem
         * que nenhum deles conheça os outros.
         */
        await deps.unidadeDeTrabalho.executar(async (tx) => {
          await deps.repositorio.gravar(plano, tx);
          await deps.barramento.publicar(plano.eventos, tx);
        });
      } catch (causa) {
        if (causa instanceof TentativaJaRegistrada) return ok(REPETIDA);

        /*
         * Conflito numa linha quente — pode ter sido o domínio, a progressão
         * ou a carteira; daqui não se sabe e não importa. Recalcular do zero é
         * obrigatório: reaproveitar o plano aplicaria o BKT sobre uma
         * probabilidade que já não existe, e a tentativa seria contada duas
         * vezes no modelo.
         */
        if (causa instanceof ConflitoDeConcorrencia) {
          const espera = ESPERAS_MS[rodada];
          if (espera !== undefined) await deps.dormir(espera);
          continue;
        }

        throw causa;
      }

      return ok({
        premio: plano.premio,
        repetida: false,
        dominio: plano.dominio
          ? {
              probabilidade: plano.dominio.proximo.probabilidade,
              habilidade: plano.dominio.proximo.habilidade,
              dominouAgora:
                plano.dominio.anterior.dominadaEm === null &&
                plano.dominio.proximo.dominadaEm !== null,
            }
          : null,
        proximaRevisaoEm: plano.revisao?.proximo.venceEm ?? null,
        numeroDaTentativa: contexto.tentativasNaAtividade + 1,
      });
    }

    return err(
      conflict(
        "assessment.concurrent_update",
        "Não conseguimos registrar esta resposta agora. Tente de novo.",
        { idempotencyKey: entrada.idempotencyKey },
      ),
    );
  };
}
