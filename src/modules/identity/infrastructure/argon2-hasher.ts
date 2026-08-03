import { hash, verify } from "@node-rs/argon2";

import type { PasswordHasher } from "../application/ports";

/**
 * Argon2id — vencedor do Password Hashing Competition e a recomendação atual
 * do OWASP para senhas novas.
 *
 * Parâmetros conforme o *OWASP Password Storage Cheat Sheet* (perfil de 19 MiB):
 * memória 19 MiB, 2 iterações, paralelismo 1. A escolha é deliberada para o
 * ambiente serverless da Vercel: perfis com mais memória (64 MiB+) protegem um
 * pouco melhor, mas em função sem estado com limite de memória e cold start
 * eles viram timeout de login — e um login que falha empurra o produto para
 * senhas mais fracas ou para desligar o hash caro. Melhor um perfil sólido que
 * roda sempre.
 *
 * Argon2id já embute o sal na saída; não existe coluna de sal no schema por
 * isso, e não porque alguém esqueceu.
 */
const PARAMETROS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export class Argon2Hasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return hash(plain, PARAMETROS);
  }

  async verify(hashGuardado: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashGuardado, plain, PARAMETROS);
    } catch {
      // Hash corrompido ou em formato desconhecido: é "não confere", não é
      // uma exceção que deva derrubar o login de todo mundo.
      return false;
    }
  }

  /**
   * Queima o mesmo tempo de CPU de uma verificação real quando não há conta.
   *
   * Sem isto, "e-mail não existe" responde em ~1 ms e "senha errada" responde
   * em ~50 ms. Essa diferença é medível pela rede e enumera contas tão bem
   * quanto uma mensagem de erro específica (docs/09 §5).
   */
  async fakeVerify(): Promise<void> {
    await verify(HASH_DESCARTAVEL, "senha-que-nunca-vai-conferir", PARAMETROS).catch(
      () => false,
    );
  }
}

/**
 * Hash fixo de uma senha aleatória descartada. Precisa ser um Argon2id válido
 * com os mesmos parâmetros, senão a verificação falha cedo e o tempo não bate.
 */
const HASH_DESCARTAVEL =
  "$argon2id$v=19$m=19456,t=2,p=1$HSJI2f6sJhqDwJTfLx7TAA$0hX371lbZ8Q73matrvWgWjH4bJkbteewwTzJpFa/iKI";
