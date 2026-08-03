import { err, ok, validationError, type Result } from "@/shared/kernel";

/**
 * Senha em texto claro — objeto de vida curtíssima.
 *
 * Só existe entre "o responsável digitou" e "o hasher consumiu". Nunca é
 * serializada, nunca é logada, nunca vai para o banco. As sobrescritas de
 * `toJSON` e `toString` abaixo não são decoração: um `console.log(input)`
 * distraído em um caso de uso seria um vazamento de senha em texto puro no
 * agregador de logs.
 */
export class PlainPassword {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  /**
   * Política de senha seguindo a orientação moderna (NIST SP 800-63B):
   * **comprimento no lugar de composição obrigatória**. Exigir "uma maiúscula,
   * um número e um símbolo" produz `Senha@123` — previsível e mais fraco que
   * uma frase longa. Cobramos tamanho e barramos o óbvio.
   */
  static create(input: string, email?: string): Result<PlainPassword> {
    if (input.length < 10) {
      return err(
        validationError(
          "password.too_short",
          "A senha precisa de pelo menos 10 caracteres. Uma frase curta funciona bem.",
        ),
      );
    }

    // Argon2 sobre entrada gigante é vetor de negação de serviço barato.
    if (input.length > 128) {
      return err(
        validationError("password.too_long", "A senha pode ter no máximo 128 caracteres."),
      );
    }

    const normalizada = input.toLowerCase();

    if (BLOQUEADAS.has(normalizada)) {
      return err(
        validationError(
          "password.too_common",
          "Esta senha é uma das mais usadas do mundo — escolha outra.",
        ),
      );
    }

    if (/^(.)\1+$/.test(input)) {
      return err(
        validationError("password.repeated_character", "Repetir o mesmo caractere não protege nada."),
      );
    }

    if (email) {
      const parteLocal = email.split("@")[0]?.toLowerCase() ?? "";
      if (parteLocal.length >= 3 && normalizada.includes(parteLocal)) {
        return err(
          validationError(
            "password.contains_email",
            "A senha não pode conter o seu e-mail.",
          ),
        );
      }
    }

    return ok(new PlainPassword(input));
  }

  /** Único caminho de saída — consumido pelo hasher e por mais ninguém. */
  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return "[senha omitida]";
  }

  toJSON(): string {
    return "[senha omitida]";
  }
}

/**
 * Lista curta e proposital. A defesa real contra adivinhação é o rate limit de
 * docs/09 §5; isto só impede o caso constrangedor de `senha123456` proteger o
 * painel onde ficam os dados de uma criança.
 */
const BLOQUEADAS = new Set([
  "senha123456",
  "1234567890",
  "0123456789",
  "senhasenha",
  "password12",
  "password123",
  "qwertyuiop",
  "abcdefghij",
  "crescendoeaprendendo",
  "crescendo123",
]);
