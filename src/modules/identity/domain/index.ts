/**
 * Camada de domínio do módulo de identidade — TypeScript puro.
 *
 * Nada aqui conhece Prisma, Next ou React. As fronteiras são verificadas em CI
 * (`.dependency-cruiser.cjs` e `eslint.config.mjs`).
 */

export { Account, type AccountState, type AccountStatus } from "./account";
export { Email } from "./email";
export { PlainPassword } from "./password";
export { ParentPin } from "./parent-pin";
export { DisplayName, GuardianName } from "./display-name";
export { AVATAR_PADRAO, avatarConfigSchema, type AvatarConfig } from "./avatar-config";
export {
  type AgeBand,
  type FaixaResolvida,
  FAIXAS_DISPONIVEIS,
  faixaParaIdade,
  idadeAproximada,
  resolverFaixaEtaria,
} from "./age-band";
