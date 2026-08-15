/**
 * API pública do módulo de identidade.
 *
 * Este arquivo é a fronteira: de fora, importa-se `@/modules/identity` e mais
 * nada. Alcançar `@/modules/identity/domain/...` a partir de outro módulo é
 * erro de fronteira, verificado em CI (`.dependency-cruiser.cjs`, regra
 * `modulos-so-pela-api-publica`).
 *
 * O que NÃO sai daqui, de propósito: repositórios, o hasher e o mailer. Quem
 * precisa deles é o composition root — ninguém mais deveria conseguir montar
 * um `IdentityDeps` por conta própria.
 */

// ── Domínio exposto ──────────────────────────────────────────────────────────
export {
  Account,
  DisplayName,
  Email,
  GuardianName,
  ParentPin,
  PlainPassword,
  type AccountStatus,
  type AgeBand,
  FAIXAS_DISPONIVEIS,
  faixaParaIdade,
  idadeAproximada,
  resolverFaixaEtaria,
} from "./domain";

// ── Contratos ────────────────────────────────────────────────────────────────
export type { IdentityDeps, RequestContext } from "./application/deps";
export type { ConfiguracoesDoAprendiz, PerfilDeCrianca } from "./application/ports";
export { DURACAO, LIMITES } from "./application/policy";

// ── Casos de uso ─────────────────────────────────────────────────────────────
export { registrarResponsavel } from "./application/use-cases/register-guardian";
export type {
  RegistrarResponsavelInput,
  RegistrarResponsavelOutput,
} from "./application/use-cases/register-guardian";

export { reenviarVerificacao, verificarEmail } from "./application/use-cases/verify-email";

export { pedirRedefinicaoDeSenha, redefinirSenha } from "./application/use-cases/reset-password";
export type {
  PedirRedefinicaoOutput,
  RedefinirSenhaOutput,
} from "./application/use-cases/reset-password";

export { entrar, sair } from "./application/use-cases/sign-in";
export type { EntrarInput, EntrarOutput } from "./application/use-cases/sign-in";

export { resolverSessao } from "./application/use-cases/resolve-session";
export type { Ator } from "./application/use-cases/resolve-session";

export {
  criarPerfilDeCrianca,
  definirPinDoResponsavel,
  listarFamilia,
} from "./application/use-cases/manage-family";
export type { CriarPerfilInput } from "./application/use-cases/manage-family";

export {
  encerrarSessaoDeCrianca,
  iniciarSessaoDeCrianca,
} from "./application/use-cases/learner-session";
export type { SessaoDeCriancaAberta } from "./application/use-cases/learner-session";

export {
  atualizarConfiguracoesDoAprendiz,
  obterConfiguracoesDoAprendiz,
} from "./application/use-cases/manage-settings";
export type { AtualizarConfiguracoesInput } from "./application/use-cases/manage-settings";
