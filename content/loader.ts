import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import type { ActivityRegistry, RegraDeRecompensa } from "@/activities";

import {
  academiaSchema,
  catalogoDeColecionaveisSchema,
  disciplinaCurricularSchema,
  disciplinaSchema,
  missaoSchema,
  moduloSchema,
  nivelSchema,
  type Academia,
  type AtividadeAutorada,
  type Colecionavel,
  type Disciplina,
  type DisciplinaCurricular,
  type Missao,
  type Modulo,
  type Nivel,
} from "./schema";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CARREGADOR DE CONTEÚDO
 *
 *  Percorre `content/`, valida cada arquivo e devolve o acervo em memória.
 *  É usado por dois consumidores:
 *   · `scripts/validate-content.ts` — barreira de CI
 *   · o importador para o banco — que popula Postgres a partir dos arquivos
 *
 *  A hierarquia de diretórios É o modelo:
 *
 *    content/
 *      curriculo/<disciplina>.json          ← competências e objetivos
 *      academias/
 *        <academia>/academia.json
 *          <disciplina>/disciplina.json
 *            <FAIXA>/                       ← SPROUT, EXPLORER…
 *              <nivel>/nivel.json
 *                <modulo>/modulo.json
 *                  missao-*.json            ← missão, com fases e atividades
 *
 *  Nenhum índice central: adicionar uma missão é criar um arquivo, e o
 *  carregador a encontra. Um índice seria mais um lugar para esquecer de
 *  atualizar.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface MissaoCarregada {
  readonly academia: string;
  readonly disciplina: string;
  readonly faixa: string;
  readonly nivel: string;
  readonly modulo: string;
  readonly caminho: string;
  readonly missao: Missao;
}

export interface Acervo {
  readonly curriculos: readonly DisciplinaCurricular[];
  readonly academias: readonly Academia[];
  readonly disciplinas: readonly { readonly academia: string; readonly disciplina: Disciplina }[];
  readonly niveis: readonly Nivel[];
  readonly modulos: readonly Modulo[];
  readonly missoes: readonly MissaoCarregada[];
  readonly colecionaveis: readonly Colecionavel[];
}

export interface ProblemaDeConteudo {
  readonly arquivo: string;
  readonly mensagem: string;
}

export interface ResultadoDoCarregamento {
  readonly acervo: Acervo;
  readonly problemas: readonly ProblemaDeConteudo[];
}

const RAIZ_PADRAO = join(process.cwd(), "content");

export async function carregarAcervo(
  raiz: string = RAIZ_PADRAO,
): Promise<ResultadoDoCarregamento> {
  const problemas: ProblemaDeConteudo[] = [];

  const curriculos: DisciplinaCurricular[] = [];
  const academias: Academia[] = [];
  const disciplinas: { academia: string; disciplina: Disciplina }[] = [];
  const niveis: Nivel[] = [];
  const modulos: Modulo[] = [];
  const missoes: MissaoCarregada[] = [];
  let colecionaveis: readonly Colecionavel[] = [];

  /** Lê e valida um JSON. Problema vira relatório, nunca exceção. */
  async function ler<T>(
    caminho: string,
    schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  ): Promise<T | null> {
    let bruto: unknown;
    try {
      bruto = JSON.parse(await readFile(caminho, "utf8"));
    } catch (causa) {
      problemas.push({
        arquivo: caminho,
        mensagem: `JSON inválido: ${causa instanceof Error ? causa.message : String(causa)}`,
      });
      return null;
    }

    const analise = schema.safeParse(bruto);
    if (!analise.success) {
      for (const problema of analise.error.issues) {
        const onde = problema.path.join(".");
        problemas.push({
          arquivo: caminho,
          mensagem: onde ? `${onde}: ${problema.message}` : problema.message,
        });
      }
      return null;
    }
    return analise.data;
  }

  async function pastas(caminho: string): Promise<string[]> {
    try {
      const entradas = await readdir(caminho, { withFileTypes: true });
      return entradas.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    } catch {
      return [];
    }
  }

  async function arquivosJson(caminho: string, prefixo: string): Promise<string[]> {
    try {
      const entradas = await readdir(caminho, { withFileTypes: true });
      return entradas
        .filter((e) => e.isFile() && e.name.startsWith(prefixo) && e.name.endsWith(".json"))
        .map((e) => e.name)
        .sort();
    } catch {
      return [];
    }
  }

  // ── Currículo ──────────────────────────────────────────────────────────────
  const dirCurriculo = join(raiz, "curriculo");
  for (const arquivo of await arquivosJson(dirCurriculo, "")) {
    const curriculo = await ler(join(dirCurriculo, arquivo), disciplinaCurricularSchema);
    if (curriculo) curriculos.push(curriculo);
  }

  // ── Catálogo de colecionáveis ────────────────────────────────────────────
  // Arquivo único, não uma pasta: o catálogo não é escopado por academia. Ausente
  // é um acervo válido sem figurinhas — não um erro (mesmo espírito de `pastas`).
  const caminhoDoCatalogo = join(raiz, "colecionaveis.json");
  if (
    await stat(caminhoDoCatalogo)
      .then(() => true)
      .catch(() => false)
  ) {
    const catalogo = await ler(caminhoDoCatalogo, catalogoDeColecionaveisSchema);
    if (catalogo) colecionaveis = catalogo.colecionaveis;
  }

  // ── Academias e o que está abaixo delas ────────────────────────────────────
  const dirAcademias = join(raiz, "academias");

  for (const nomeAcademia of await pastas(dirAcademias)) {
    const dirAcademia = join(dirAcademias, nomeAcademia);
    const academia = await ler(join(dirAcademia, "academia.json"), academiaSchema);
    if (academia) academias.push(academia);

    for (const nomeDisciplina of await pastas(dirAcademia)) {
      const dirDisciplina = join(dirAcademia, nomeDisciplina);
      const disciplina = await ler(join(dirDisciplina, "disciplina.json"), disciplinaSchema);
      if (disciplina) disciplinas.push({ academia: nomeAcademia, disciplina });

      for (const faixa of await pastas(dirDisciplina)) {
        const dirFaixa = join(dirDisciplina, faixa);

        for (const nomeNivel of await pastas(dirFaixa)) {
          const dirNivel = join(dirFaixa, nomeNivel);
          const nivel = await ler(join(dirNivel, "nivel.json"), nivelSchema);
          if (nivel) niveis.push(nivel);

          for (const nomeModulo of await pastas(dirNivel)) {
            const dirModulo = join(dirNivel, nomeModulo);
            const modulo = await ler(join(dirModulo, "modulo.json"), moduloSchema);
            if (modulo) modulos.push(modulo);

            for (const arquivo of await arquivosJson(dirModulo, "missao-")) {
              const caminho = join(dirModulo, arquivo);
              const missao = await ler(caminho, missaoSchema);
              if (missao) {
                missoes.push({
                  academia: nomeAcademia,
                  disciplina: nomeDisciplina,
                  faixa,
                  nivel: nomeNivel,
                  modulo: nomeModulo,
                  caminho,
                  missao,
                });
              }
            }
          }
        }
      }
    }
  }

  return {
    acervo: { curriculos, academias, disciplinas, niveis, modulos, missoes, colecionaveis },
    problemas,
  };
}

/**
 * Segunda passada: valida cada `config` pelo `configSchema` do plugin do tipo,
 * e confere que toda referência aponta para algo que existe.
 *
 * Esta é a checagem que o schema de autoria **não pode** fazer sozinho: ele não
 * sabe o que é uma múltipla escolha. Quem sabe é o plugin — e é justamente essa
 * divisão que permite adicionar tipos sem tocar no schema de conteúdo.
 */
export function validarReferenciasEConfigs(
  acervo: Acervo,
  registro: ActivityRegistry,
): readonly ProblemaDeConteudo[] {
  const problemas: ProblemaDeConteudo[] = [];

  const objetivosConhecidos = new Set(
    acervo.curriculos.flatMap((c) => c.competencias.flatMap((k) => k.objetivos.map((o) => o.slug))),
  );
  const curriculosConhecidos = new Set(acervo.curriculos.map((c) => c.slug));

  // Pré-requisitos precisam existir, senão o DAG tem aresta para lugar nenhum.
  for (const curriculo of acervo.curriculos) {
    for (const competencia of curriculo.competencias) {
      for (const objetivo of competencia.objetivos) {
        for (const preRequisito of objetivo.preRequisitos) {
          if (!objetivosConhecidos.has(preRequisito)) {
            problemas.push({
              arquivo: `curriculo/${curriculo.slug}.json`,
              mensagem: `O objetivo "${objetivo.slug}" exige o pré-requisito "${preRequisito}", que não existe.`,
            });
          }
        }
      }
    }
  }

  for (const { academia, disciplina } of acervo.disciplinas) {
    if (!curriculosConhecidos.has(disciplina.curriculo)) {
      problemas.push({
        arquivo: `academias/${academia}/${disciplina.slug}/disciplina.json`,
        mensagem: `Aponta para o currículo "${disciplina.curriculo}", que não existe em content/curriculo/.`,
      });
    }
  }

  // Código repetido no catálogo colidiria em `Collectible.code`, único no banco.
  const colecionaveisConhecidos = new Set<string>();
  for (const colecionavel of acervo.colecionaveis) {
    if (colecionaveisConhecidos.has(colecionavel.code)) {
      problemas.push({
        arquivo: "colecionaveis.json",
        mensagem: `Código de colecionável repetido: "${colecionavel.code}".`,
      });
    }
    colecionaveisConhecidos.add(colecionavel.code);
  }

  const slugsDeMissao = new Set<string>();

  for (const carregada of acervo.missoes) {
    const { missao, caminho } = carregada;

    if (slugsDeMissao.has(missao.slug)) {
      problemas.push({ arquivo: caminho, mensagem: `Slug de missão repetido: "${missao.slug}".` });
    }
    slugsDeMissao.add(missao.slug);

    problemas.push(
      ...validarColecionaveisDaRecompensa(
        missao.recompensaDaMissao,
        colecionaveisConhecidos,
        caminho,
        "recompensaDaMissao",
      ),
    );

    const slugsDeAtividade = new Set<string>();

    for (const fase of missao.fases) {
      for (const atividade of fase.atividades) {
        const rotulo = `${fase.slug}/${atividade.slug}`;

        if (slugsDeAtividade.has(atividade.slug)) {
          problemas.push({ arquivo: caminho, mensagem: `Slug de atividade repetido: "${atividade.slug}".` });
        }
        slugsDeAtividade.add(atividade.slug);

        if (!objetivosConhecidos.has(atividade.objetivo)) {
          problemas.push({
            arquivo: caminho,
            mensagem: `${rotulo}: objetivo "${atividade.objetivo}" não existe no currículo.`,
          });
        }

        problemas.push(...validarConfigDaAtividade(atividade, registro, caminho, rotulo));
        problemas.push(
          ...validarColecionaveisDaRecompensa(
            atividade.recompensa,
            colecionaveisConhecidos,
            caminho,
            rotulo,
          ),
        );

        if (fase.minimoParaPassar !== undefined && fase.minimoParaPassar > fase.atividades.length) {
          problemas.push({
            arquivo: caminho,
            mensagem: `${fase.slug}: exige ${fase.minimoParaPassar} acertos, mas tem só ${fase.atividades.length} atividades.`,
          });
        }
      }
    }
  }

  return problemas;
}

/**
 * Todo código em `colecionaveis` (missão ou atividade) precisa existir no
 * catálogo — senão a criança ganha um prêmio que a galeria não sabe mostrar,
 * e o código nunca vira figurinha nenhuma (`Collectible.code` não bate).
 */
function validarColecionaveisDaRecompensa(
  regra: RegraDeRecompensa | null | undefined,
  colecionaveisConhecidos: ReadonlySet<string>,
  arquivo: string,
  rotulo: string,
): readonly ProblemaDeConteudo[] {
  if (!regra) return [];

  const problemas: ProblemaDeConteudo[] = [];
  for (const [desfecho, premio] of Object.entries(regra.porDesfecho)) {
    if (!premio) continue;
    for (const code of premio.colecionaveis) {
      if (!colecionaveisConhecidos.has(code)) {
        problemas.push({
          arquivo,
          mensagem: `${rotulo} (${desfecho}): colecionável "${code}" não existe em content/colecionaveis.json.`,
        });
      }
    }
  }
  return problemas;
}

function validarConfigDaAtividade(
  atividade: AtividadeAutorada,
  registro: ActivityRegistry,
  arquivo: string,
  rotulo: string,
): readonly ProblemaDeConteudo[] {
  const plugin = registro.obter(atividade.tipo);

  if (!plugin.ok) {
    return [
      {
        arquivo,
        mensagem:
          `${rotulo}: tipo "${atividade.tipo}" não tem plugin registrado. ` +
          `Tipos jogáveis hoje: ${registro.tiposDisponiveis().join(", ")}.`,
      },
    ];
  }

  const config = plugin.value.validarConfig(atividade.config);
  if (config.ok) return [];

  const detalhes = config.error.details?.problemas;
  const lista = Array.isArray(detalhes) ? detalhes : [config.error.message];

  return lista.map((problema) => ({
    arquivo,
    mensagem: `${rotulo}: ${String(problema)}`,
  }));
}
