import { z } from "zod";

/**
 * Configuração do avatar da criança — coluna `Learner.avatarConfig` (Json).
 *
 * Regra transversal de docs/04 §1: **todo Json tem schema Zod e `schemaVersion`**.
 * Sem a versão, o dia em que a lista de camadas mudar transforma toda linha
 * antiga em armadilha silenciosa; com ela, a migração é explícita e verificável.
 */
export const avatarConfigSchema = z.object({
  schemaVersion: z.literal(1),
  /** Índices dentro dos catálogos de peças. O catálogo em si é conteúdo, não código. */
  pele: z.number().int().min(0).max(31),
  cabelo: z.number().int().min(0).max(63),
  corDoCabelo: z.number().int().min(0).max(31),
  roupa: z.number().int().min(0).max(63),
  acessorio: z.number().int().min(0).max(63).nullable(),
});

export type AvatarConfig = z.infer<typeof avatarConfigSchema>;

/**
 * Avatar inicial neutro. A criança personaliza no primeiro acesso — mas ela
 * precisa existir na tela antes de escolher, e um avatar vazio não existe.
 */
export const AVATAR_PADRAO: AvatarConfig = {
  schemaVersion: 1,
  pele: 0,
  cabelo: 0,
  corDoCabelo: 0,
  roupa: 0,
  acessorio: null,
};
