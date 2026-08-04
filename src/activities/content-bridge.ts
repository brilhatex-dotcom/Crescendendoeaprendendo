import { refDeAtividade, refDeMissao } from "@/modules/content";
import { carregarAcervo } from "@/content/loader";

import type { MissaoNaSessao } from "./session";

/**
 * Ponte entre o acervo em arquivo e a sessão de missão.
 *
 * Existe para que o executor de missão não conheça `content/`: ele recebe uma
 * `MissaoNaSessao` e mais nada. Quando o conteúdo passar a vir do banco — que é
 * o destino, com os arquivos virando a fonte versionada que alimenta o
 * importador — só esta função muda.
 *
 * Roda apenas no servidor: lê disco.
 */
export async function carregarMissaoParaSessao(
  slug: string,
): Promise<MissaoNaSessao | null> {
  const { acervo } = await carregarAcervo();
  const encontrada = acervo.missoes.find((m) => m.missao.slug === slug);
  if (!encontrada) return null;

  const { missao } = encontrada;

  return {
    slug: missao.slug,
    ref: refDeMissao(encontrada),
    nome: missao.nome,
    introducao: missao.introducao,
    conclusao: missao.conclusao,
    recompensaDaMissao: missao.recompensaDaMissao,
    fases: missao.fases.map((fase) => ({
      slug: fase.slug,
      nome: fase.nome,
      atividades: fase.atividades.map((atividade) => ({
        slug: atividade.slug,
        // A mesma função que o importador usa para gravar `Activity.sourceRef`.
        // Duas implementações da regra de nomeação seria o jeito garantido de
        // um dia a busca não encontrar a linha que ela própria criou.
        ref: refDeAtividade(encontrada, fase.slug, atividade.slug),
        tipo: atividade.tipo,
        objetivo: atividade.objetivo,
        config: atividade.config,
        dificuldade: atividade.dificuldade,
        recompensa: atividade.recompensa,
      })),
    })),
  };
}

/** Todas as missões publicadas, para o mapa. */
export async function listarMissoes(): Promise<
  readonly { readonly slug: string; readonly nome: string; readonly atividades: number }[]
> {
  const { acervo } = await carregarAcervo();

  return acervo.missoes.map(({ missao }) => ({
    slug: missao.slug,
    nome: missao.nome,
    atividades: missao.fases.reduce((total, f) => total + f.atividades.length, 0),
  }));
}
