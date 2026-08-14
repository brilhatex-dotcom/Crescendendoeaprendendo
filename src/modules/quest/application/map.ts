import type { ArestaDoLayout, LayoutDoMapa } from "../domain/map-layout";
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

export interface NoDoMapaVisual {
  readonly x: number;
  readonly y: number;
  readonly missao: MissaoDoMapa;
}

/** Geografia de um mundo — presente só quando o conteúdo autorou um layout. */
export interface MapaVisual {
  readonly nos: readonly NoDoMapaVisual[];
  readonly arestas: readonly ArestaDoLayout[];
}

export interface MundoDoMapa {
  readonly slug: string;
  readonly nome: string;
  readonly academia: string;
  /** Nível mínimo para o mundo aparecer (`World.minLevel`). */
  readonly nivelMinimo: number;
  readonly disponivel: boolean;
  readonly capitulos: readonly CapituloDoMapa[];
  /**
   * `null` = mundo ainda sem geografia desenhada. A tela cai para a lista de
   * `capitulos` — nunca uma página quebrada por causa de um mundo não mapeado.
   */
  readonly mapa: MapaVisual | null;
}

export type MontarMapa = (learnerId: string) => Promise<readonly MundoDoMapa[]>;

export function criarMontarMapa(deps: {
  readonly leitura: LeituraDoMapa;
}): MontarMapa {
  return async function montarMapa(learnerId) {
    const { mundos, estado, concluidas, emAndamento } =
      await deps.leitura.mapaDaCrianca(learnerId);

    return mundos.map((mundo) => {
      const capitulos = mundo.capitulos.map((capitulo) => ({
        nome: capitulo.nome,
        missoes: capitulo.missoes.map((missao) => paraOMapa(missao, estado, concluidas, emAndamento)),
      }));

      const missoesPorRef = new Map(
        capitulos.flatMap((capitulo) => capitulo.missoes.map((missao) => [missao.ref, missao] as const)),
      );

      return {
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
        capitulos,
        mapa: montarMapaVisual(mundo.layout, missoesPorRef),
      };
    });
  };
}

/**
 * Traduz o layout bruto (referências de missão) para o mapa que a tela
 * desenha (nós com a missão inteira já avaliada).
 *
 * Um nó cujo `missaoRef` não bate com nenhuma missão deste mundo é conteúdo
 * defasado — banco com um layout mais velho que o acervo atual — e é
 * descartado em silêncio, não travado: o mesmo raciocínio de
 * `lerLayoutDoMapa` (irreconhecível não é erro fatal, é "sem mapa ainda").
 */
function montarMapaVisual(
  layout: LayoutDoMapa,
  missoesPorRef: ReadonlyMap<string, MissaoDoMapa>,
): MapaVisual | null {
  if (layout.nos.length === 0) return null;

  const nos: NoDoMapaVisual[] = [];
  for (const no of layout.nos) {
    const missao = missoesPorRef.get(no.missaoRef);
    if (missao) nos.push({ x: no.x, y: no.y, missao });
  }
  if (nos.length === 0) return null;

  const idsComNo = new Set(nos.map((no) => no.missao.ref));
  const arestas = layout.arestas.filter((aresta) => idsComNo.has(aresta.de) && idsComNo.has(aresta.para));

  return { nos, arestas };
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
