/**
 * MÓDULO CONTENT — API pública.
 *
 * Publica o acervo de `content/` no Postgres. É a ponte entre o conteúdo como
 * dado versionado em git e as linhas que `Attempt` vai referenciar.
 *
 * Fronteira do módulo: quem está de fora importa daqui e de mais nenhum lugar
 * (verificado por dependency-cruiser).
 */

export {
  criarImportarConteudo,
  type ImportarConteudo,
  type ImportarConteudoEntrada,
  type ImportarConteudoSaida,
} from "./application/import-content";

export {
  RESUMO_VAZIO,
  type EscritorDeConteudo,
  type ResumoDaEscrita,
} from "./application/ports";

export {
  planejarImportacao,
  refDeAtividade,
  refDeCapitulo,
  refDeMissao,
  type PlanoDeImportacao,
  type ProblemaDePlano,
  type ResultadoDoPlano,
} from "./domain/plan";
