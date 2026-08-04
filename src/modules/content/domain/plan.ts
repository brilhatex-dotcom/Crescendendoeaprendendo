import { DIFICULDADE_INICIAL, type DifficultyLabel } from "@/activities";
import type { RegraDeDesbloqueio } from "@/modules/quest";
import type { Acervo, MissaoCarregada } from "@/content/loader";
import type { DisciplinaCurricular } from "@/content/schema";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PLANO DE IMPORTAÇÃO — tradução pura de `content/` para linhas do banco
 *
 *  Função pura: entra o acervo já carregado e validado, sai o plano de escrita.
 *  Nenhum acesso a disco, nenhum Prisma, nenhuma transação. Isso permite testar
 *  todo o mapeamento — que é onde moram os erros sutis — sem subir banco.
 *
 *  ── Correspondência entre o modelo de autoria e o modelo de dados ──
 *  Os dois modelos nasceram separados e não são idênticos. As decisões:
 *
 *   autoria (content/)          banco (docs/04)      por quê
 *   ─────────────────────────   ──────────────────   ───────────────────────
 *   disciplinaCurricular    →   Subject              raiz do currículo
 *   competência             →   Strand               agrupa objetivos
 *   objetivo                →   Skill                é o objetivo que carrega
 *                                                    código BNCC e pré-requisito,
 *                                                    e no banco isso vive em Skill
 *   (sintético, 1:1)        →   Objective            Activity exige objectiveId;
 *                                                    a autoria ainda não divide
 *                                                    objetivo em sub-objetivos
 *   nível                   →   World                mapa de uma faixa etária
 *   módulo                  →   Chapter
 *   missão                  →   Quest
 *   fase                    →   Stage
 *   atividade               →   Activity + StageActivity
 *
 *  A linha do `Objective` sintético é a única invenção. Ela existe porque
 *  `Activity.objectiveId` é obrigatório e a autoria não tem esse nível ainda.
 *  Quando o conteúdo precisar dividir um objetivo, o lugar já está pronto.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Chaves naturais ──────────────────────────────────────────────────────────

/** `Subject.code` é único global; a academia entra na chave para não colidir. */
export const codigoDeDisciplina = (academia: string, disciplina: string): string =>
  `${academia}.${disciplina}`;

/** `World.slug` é único por academia. Faixa e disciplina entram na chave. */
export const slugDeMundo = (
  disciplina: string,
  faixa: string,
  nivel: string,
): string => `${disciplina}-${faixa.toLowerCase()}-${nivel}`;

export const refDeCapitulo = (m: MissaoCarregada): string =>
  `${m.academia}/${m.disciplina}/${m.faixa}/${m.nivel}/${m.modulo}`;

export const refDeMissao = (m: MissaoCarregada): string =>
  `${refDeCapitulo(m)}/${m.missao.slug}`;

export const refDeAtividade = (
  m: MissaoCarregada,
  faseSlug: string,
  atividadeSlug: string,
): string => `${refDeMissao(m)}/${faseSlug}/${atividadeSlug}`;

// ── Linhas do plano ──────────────────────────────────────────────────────────

export interface LinhaAcademia {
  readonly slug: string;
  readonly nome: string;
  readonly ilha: string;
  readonly guardiao: string;
  readonly tema: { readonly de: string; readonly para: string; readonly brilho: string };
  readonly ordem: number;
}

export interface LinhaDisciplina {
  readonly codigo: string;
  readonly academiaSlug: string;
  readonly nome: string;
  readonly ordem: number;
}

export interface LinhaEixo {
  readonly disciplinaCodigo: string;
  readonly codigo: string;
  readonly nome: string;
  readonly ordem: number;
}

export interface LinhaCompetencia {
  readonly disciplinaCodigo: string;
  readonly eixoCodigo: string;
  /** Identidade dentro do eixo. É o slug do objetivo autorado. */
  readonly nome: string;
  readonly descricao: string;
  readonly codigoBncc: string | null;
  readonly dificuldadeRef: number;
  readonly ordem: number;
}

export interface LinhaPreRequisito {
  readonly disciplinaCodigo: string;
  readonly competenciaNome: string;
  readonly preRequisitoNome: string;
}

export interface LinhaObjetivo {
  readonly disciplinaCodigo: string;
  readonly competenciaNome: string;
  readonly nome: string;
  readonly ordem: number;
}

export interface LinhaMundo {
  readonly academiaSlug: string;
  readonly slug: string;
  readonly nome: string;
  readonly nivelMinimo: number;
  readonly ordem: number;
}

export interface LinhaCapitulo {
  readonly ref: string;
  readonly academiaSlug: string;
  readonly mundoSlug: string;
  readonly nome: string;
  readonly ordem: number;
}

export interface LinhaMissao {
  readonly ref: string;
  readonly capituloRef: string;
  readonly tipo: string;
  readonly nome: string;
  readonly narrativa: { readonly introducao: string; readonly conclusao: string };
  readonly xp: number;
  readonly moedas: number;
  readonly cristais: number;
  readonly competenciasExigidas: readonly string[];
  readonly regraDeDesbloqueio: RegraDeDesbloqueio | null;
  readonly ordem: number;
}

export interface LinhaFase {
  readonly missaoRef: string;
  readonly ordem: number;
  readonly regra: { readonly nome: string; readonly minimoParaPassar: number | null };
}

export interface LinhaAtividade {
  readonly ref: string;
  readonly disciplinaCodigo: string;
  readonly competenciaNome: string;
  readonly objetivoNome: string;
  readonly tipo: string;
  readonly config: unknown;
  readonly dificuldade: number;
  readonly duracaoEstimadaSeg: number;
  readonly faixaMinima: string;
  readonly faixaMaxima: string;
}

export interface LinhaVinculo {
  readonly missaoRef: string;
  readonly faseOrdem: number;
  readonly ordem: number;
  readonly atividadeRef: string;
}

export interface PlanoDeImportacao {
  readonly academias: readonly LinhaAcademia[];
  readonly disciplinas: readonly LinhaDisciplina[];
  readonly eixos: readonly LinhaEixo[];
  readonly competencias: readonly LinhaCompetencia[];
  readonly preRequisitos: readonly LinhaPreRequisito[];
  readonly objetivos: readonly LinhaObjetivo[];
  readonly mundos: readonly LinhaMundo[];
  readonly capitulos: readonly LinhaCapitulo[];
  readonly missoes: readonly LinhaMissao[];
  readonly fases: readonly LinhaFase[];
  readonly atividades: readonly LinhaAtividade[];
  readonly vinculos: readonly LinhaVinculo[];
}

export interface ProblemaDePlano {
  readonly onde: string;
  readonly mensagem: string;
}

export interface ResultadoDoPlano {
  readonly plano: PlanoDeImportacao;
  readonly problemas: readonly ProblemaDePlano[];
}

// ── Construção do plano ──────────────────────────────────────────────────────

/**
 * Recompensa da missão: só o prêmio de acerto, sem fator de dificuldade.
 *
 * `Quest` guarda três inteiros; a regra completa (multiplicador por dica,
 * decaimento por repetição) continua no motor e é aplicada em tempo de jogo.
 * Gravar o valor cheio aqui e deixar o motor decidir o quanto vale evita duas
 * fontes de verdade sobre recompensa.
 */
function premioDaMissao(missao: MissaoCarregada["missao"]): {
  xp: number;
  moedas: number;
  cristais: number;
} {
  const base = missao.recompensaDaMissao?.porDesfecho.CORRECT;
  return {
    xp: base?.xp ?? 0,
    moedas: base?.moedas ?? 0,
    cristais: base?.cristais ?? 0,
  };
}

/** Índice objetivo-slug → competência que o contém, por currículo. */
function indexarObjetivos(
  curriculo: DisciplinaCurricular,
): { indice: Map<string, string>; duplicados: string[] } {
  const indice = new Map<string, string>();
  const duplicados: string[] = [];

  for (const competencia of curriculo.competencias) {
    for (const objetivo of competencia.objetivos) {
      if (indice.has(objetivo.slug)) {
        duplicados.push(objetivo.slug);
        continue;
      }
      indice.set(objetivo.slug, competencia.slug);
    }
  }

  return { indice, duplicados };
}

export function planejarImportacao(acervo: Acervo): ResultadoDoPlano {
  const problemas: ProblemaDePlano[] = [];

  const academias: LinhaAcademia[] = acervo.academias.map((a) => ({
    slug: a.slug,
    nome: a.nome,
    ilha: a.ilha,
    guardiao: a.guardiao,
    tema: { de: a.paleta.de, para: a.paleta.para, brilho: a.paleta.brilho },
    ordem: a.ordem,
  }));

  const academiasConhecidas = new Set(academias.map((a) => a.slug));

  // ── Currículo ──────────────────────────────────────────────────────────────
  const disciplinas: LinhaDisciplina[] = [];
  const eixos: LinhaEixo[] = [];
  const competencias: LinhaCompetencia[] = [];
  const preRequisitos: LinhaPreRequisito[] = [];
  const objetivos: LinhaObjetivo[] = [];

  /** `${academia}/${disciplina}` → código de disciplina no banco. */
  const codigoPorDisciplinaDaArvore = new Map<string, string>();
  /** código de disciplina → índice objetivo-slug → competência-slug. */
  const indicePorDisciplina = new Map<string, Map<string, string>>();

  const curriculoPorSlug = new Map(acervo.curriculos.map((c) => [c.slug, c]));

  for (const { academia, disciplina } of acervo.disciplinas) {
    if (!academiasConhecidas.has(academia)) {
      problemas.push({
        onde: `disciplina ${disciplina.slug}`,
        mensagem: `academia "${academia}" não existe no acervo.`,
      });
      continue;
    }

    const curriculo = curriculoPorSlug.get(disciplina.curriculo);
    if (!curriculo) {
      problemas.push({
        onde: `disciplina ${disciplina.slug}`,
        mensagem: `currículo "${disciplina.curriculo}" não encontrado em content/curriculo/.`,
      });
      continue;
    }

    const codigo = codigoDeDisciplina(academia, disciplina.slug);
    codigoPorDisciplinaDaArvore.set(`${academia}/${disciplina.slug}`, codigo);

    disciplinas.push({
      codigo,
      academiaSlug: academia,
      nome: disciplina.nome,
      ordem: disciplinas.length,
    });

    const { indice, duplicados } = indexarObjetivos(curriculo);
    for (const slug of duplicados) {
      problemas.push({
        onde: `currículo ${curriculo.slug}`,
        mensagem: `objetivo "${slug}" aparece em mais de uma competência. O slug precisa ser único no currículo, porque é ele que a atividade referencia.`,
      });
    }
    indicePorDisciplina.set(codigo, indice);

    curriculo.competencias.forEach((competencia, iEixo) => {
      eixos.push({
        disciplinaCodigo: codigo,
        codigo: competencia.slug,
        nome: competencia.nome,
        ordem: iEixo,
      });

      competencia.objetivos.forEach((objetivo, iObj) => {
        competencias.push({
          disciplinaCodigo: codigo,
          eixoCodigo: competencia.slug,
          nome: objetivo.slug,
          descricao: objetivo.descricao,
          codigoBncc: objetivo.codigoBncc ?? null,
          /*
           * O currículo é agnóstico de idade: a mesma competência é exercitada
           * por atividades de faixas diferentes. Quem carrega faixa é a
           * atividade, e é lá que a seleção adaptativa filtra.
           */
          dificuldadeRef: DIFICULDADE_INICIAL.MEDIO,
          ordem: iObj,
        });

        objetivos.push({
          disciplinaCodigo: codigo,
          competenciaNome: objetivo.slug,
          nome: objetivo.slug,
          ordem: 0,
        });

        for (const preRequisito of objetivo.preRequisitos) {
          if (!indice.has(preRequisito)) {
            problemas.push({
              onde: `objetivo ${objetivo.slug}`,
              mensagem: `pré-requisito "${preRequisito}" não existe no currículo "${curriculo.slug}".`,
            });
            continue;
          }
          preRequisitos.push({
            disciplinaCodigo: codigo,
            competenciaNome: objetivo.slug,
            preRequisitoNome: preRequisito,
          });
        }
      });
    });
  }

  // ── Mundo, capítulo, missão, fase, atividade ───────────────────────────────
  const mundos = new Map<string, LinhaMundo>();
  const capitulos = new Map<string, LinhaCapitulo>();
  const missoes: LinhaMissao[] = [];
  const fases: LinhaFase[] = [];
  const atividades: LinhaAtividade[] = [];
  const vinculos: LinhaVinculo[] = [];

  const nivelPorSlug = new Map(acervo.niveis.map((n) => [n.slug, n]));
  const moduloPorSlug = new Map(acervo.modulos.map((m) => [m.slug, m]));

  for (const carregada of acervo.missoes) {
    const codigoDisciplina = codigoPorDisciplinaDaArvore.get(
      `${carregada.academia}/${carregada.disciplina}`,
    );

    if (!codigoDisciplina) {
      problemas.push({
        onde: carregada.caminho,
        mensagem: `missão pertence à disciplina "${carregada.disciplina}", que não foi importada.`,
      });
      continue;
    }

    const indice = indicePorDisciplina.get(codigoDisciplina) ?? new Map<string, string>();

    const nivel = nivelPorSlug.get(carregada.nivel);
    const mundoSlug = slugDeMundo(carregada.disciplina, carregada.faixa, carregada.nivel);

    if (!mundos.has(mundoSlug)) {
      mundos.set(mundoSlug, {
        academiaSlug: carregada.academia,
        slug: mundoSlug,
        nome: nivel?.nome ?? carregada.nivel,
        nivelMinimo: nivel?.nivelMinimo ?? 1,
        ordem: nivel?.ordem ?? mundos.size,
      });
    }

    const capituloRef = refDeCapitulo(carregada);
    const modulo = moduloPorSlug.get(carregada.modulo);

    if (!capitulos.has(capituloRef)) {
      capitulos.set(capituloRef, {
        ref: capituloRef,
        academiaSlug: carregada.academia,
        mundoSlug,
        nome: modulo?.nome ?? carregada.modulo,
        ordem: modulo?.ordem ?? capitulos.size,
      });
    }

    const missaoRef = refDeMissao(carregada);
    const premio = premioDaMissao(carregada.missao);

    missoes.push({
      ref: missaoRef,
      capituloRef,
      tipo: carregada.missao.tipo,
      nome: carregada.missao.nome,
      narrativa: {
        introducao: carregada.missao.introducao,
        conclusao: carregada.missao.conclusao,
      },
      xp: premio.xp,
      moedas: premio.moedas,
      cristais: premio.cristais,
      competenciasExigidas: carregada.missao.competenciasExigidas,
      regraDeDesbloqueio: carregada.missao.desbloqueio ?? null,
      ordem: carregada.missao.ordem,
    });

    carregada.missao.fases.forEach((fase, iFase) => {
      fases.push({
        missaoRef,
        ordem: iFase,
        regra: {
          nome: fase.nome,
          minimoParaPassar: fase.minimoParaPassar ?? null,
        },
      });

      fase.atividades.forEach((atividade, iAtividade) => {
        const competenciaNome = indice.get(atividade.objetivo);

        if (competenciaNome === undefined) {
          problemas.push({
            onde: `${carregada.caminho} › ${fase.slug} › ${atividade.slug}`,
            mensagem: `objetivo "${atividade.objetivo}" não existe no currículo da disciplina.`,
          });
          return;
        }

        const ref = refDeAtividade(carregada, fase.slug, atividade.slug);

        atividades.push({
          ref,
          disciplinaCodigo: codigoDisciplina,
          competenciaNome: atividade.objetivo,
          objetivoNome: atividade.objetivo,
          tipo: atividade.tipo,
          config: atividade.config,
          dificuldade: DIFICULDADE_INICIAL[atividade.dificuldade as DifficultyLabel],
          duracaoEstimadaSeg: atividade.duracaoEstimadaSeg,
          faixaMinima: atividade.faixaMinima,
          faixaMaxima: atividade.faixaMaxima,
        });

        vinculos.push({
          missaoRef,
          faseOrdem: iFase,
          ordem: iAtividade,
          atividadeRef: ref,
        });
      });
    });
  }

  return {
    plano: {
      academias,
      disciplinas,
      eixos,
      competencias,
      preRequisitos,
      objetivos,
      mundos: [...mundos.values()],
      capitulos: [...capitulos.values()],
      missoes,
      fases,
      atividades,
      vinculos,
    },
    problemas,
  };
}
