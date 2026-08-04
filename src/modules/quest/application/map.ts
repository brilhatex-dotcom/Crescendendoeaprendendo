import type { Jogabilidade } from "../domain/unlock-rule";
import { avaliarDesbloqueio, regraEfetiva } from "../domain/unlock-rule";
import type { LeituraDoMapa, MissaoNoMapa } from "./ports";

/**
 * O MAPA DA CRIANÇA.
 *
 * Junta o que existe (mundos, capítulos, missões, na ordem em que foram
 * autorados) com o que ela já fez (nível, missões concluídas, domínio) e diz,
 * para cada missão: **dá para jogar? e se não, o que falta?**
 *
 * A segunda pergunta é a que importa. `docs/08 §3`: o mapa mostra o caminho,
 * nunca só um cadeado.
 */

export interface MissaoDoMapa {
  readonly ref: string;
  readonly slug: string;
  readonly nome: string;
  readonly tipo: string;
  readonly atividades: number;
  readonly jogabilidade: Jogabilidade;
  /** `true` quando já foi concluída alguma vez. Rejogar é sempre permitido. */
  readonly concluida: boolean;
  /** `true` quando há uma jogada aberta esperando por ela. */
  readonly emAndamento: boolean;
}

export interface CapituloDoMapa {
  readonly nome: string;
  readonly missoes: readonly MissaoDoMapa[];
}

export interface MundoDoMapa {
  readonly slug: string;
  readonly nome: string;
  readonly academia: string;
  /** Nível mínimo para o mundo aparecer (`World.minLevel`). */
  readonly nivelMinimo: number;
  readonly disponivel: boolean;
  readonly capitulos: readonly CapituloDoMapa[];
}

export type MontarMapa = (learnerId: string) => Promise<readonly MundoDoMapa[]>;

export function criarMontarMapa(deps: {
  readonly leitura: LeituraDoMapa;
}): MontarMapa {
  return async function montarMapa(learnerId) {
    const { mundos, estado, concluidas, emAndamento } =
      await deps.leitura.mapaDaCrianca(learnerId);

    return mundos.map((mundo) => ({
      slug: mundo.slug,
      nome: mundo.nome,
      academia: mundo.academia,
      nivelMinimo: mundo.nivelMinimo,
      /*
       * O mundo inteiro pode estar acima do nível dela. Isso **não** o esconde:
       * ver as ilhas que ainda vão acender é parte do que faz o arquipélago
       * parecer um lugar. Quem decide o que mostrar é a tela; aqui só dizemos
       * se está disponível.
       */
      disponivel: estado.nivel >= mundo.nivelMinimo,
      capitulos: mundo.capitulos.map((capitulo) => ({
        nome: capitulo.nome,
        missoes: capitulo.missoes.map((missao) => paraOMapa(missao, estado, concluidas, emAndamento)),
      })),
    }));
  };
}

function paraOMapa(
  missao: MissaoNoMapa,
  estado: Parameters<typeof avaliarDesbloqueio>[1],
  concluidas: ReadonlySet<string>,
  emAndamento: ReadonlySet<string>,
): MissaoDoMapa {
  return {
    ref: missao.ref,
    slug: missao.slug,
    nome: missao.nome,
    tipo: missao.tipo,
    atividades: missao.atividades,
    jogabilidade: avaliarDesbloqueio(regraEfetiva(missao), estado),
    /*
     * Concluída não tranca nada. Rejogar para praticar é livre (docs/08 §3) —
     * o que decai é a recompensa de repetição, não o direito de voltar.
     */
    concluida: concluidas.has(missao.ref),
    emAndamento: emAndamento.has(missao.ref),
  };
}
