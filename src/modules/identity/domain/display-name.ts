import { err, ok, validationError, type Result } from "@/shared/kernel";

/**
 * Apelido da criança.
 *
 * PSI4 (minimização): **nunca pedimos nome completo**. O que aparece na tela é
 * como a criança quer ser chamada. Isso não é só privacidade — é a primeira vez
 * que o produto pergunta a ela quem ela quer ser, e a resposta é dela.
 *
 * A validação existe para impedir que o campo vire canal de contato: um apelido
 * com "@" ou "http" é tentativa de colocar dado de contato onde ele não deve
 * estar, e cai fora.
 */
export class DisplayName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(input: string): Result<DisplayName> {
    // Espaços internos colapsados: "Ana   Luz" e "Ana Luz" são o mesmo apelido.
    const limpo = input.trim().replace(/\s+/g, " ");

    if (limpo.length < 2) {
      return err(
        validationError("display_name.too_short", "O apelido precisa de pelo menos 2 letras."),
      );
    }
    if (limpo.length > 24) {
      return err(
        validationError("display_name.too_long", "O apelido pode ter até 24 letras."),
      );
    }
    if (/[@:/\\]|https?/i.test(limpo)) {
      return err(
        validationError(
          "display_name.looks_like_contact",
          "O apelido não pode conter endereço de e-mail nem link.",
        ),
      );
    }
    // Letras (com acento), espaço, hífen e apóstrofo. Sem dígitos: apelido não é login.
    if (!/^[\p{L}][\p{L} '-]*$/u.test(limpo)) {
      return err(
        validationError(
          "display_name.invalid_characters",
          "Use apenas letras, espaço, hífen e apóstrofo.",
        ),
      );
    }

    return ok(new DisplayName(limpo));
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Nome do responsável. Regra mais frouxa que a do apelido — aqui o dado é de
 * adulto, com base legal própria, e um sobrenome com dígito romano ("Silva II")
 * é legítimo.
 */
export class GuardianName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(input: string): Result<GuardianName> {
    const limpo = input.trim().replace(/\s+/g, " ");

    if (limpo.length < 2) {
      return err(validationError("guardian_name.too_short", "Informe seu nome."));
    }
    if (limpo.length > 80) {
      return err(
        validationError("guardian_name.too_long", "O nome pode ter até 80 caracteres."),
      );
    }
    if (/[@:/\\]|https?/i.test(limpo)) {
      return err(
        validationError("guardian_name.looks_like_contact", "O nome não pode conter link nem e-mail."),
      );
    }

    return ok(new GuardianName(limpo));
  }

  /** Primeiro nome — é assim que falamos com o responsável na interface. */
  get firstName(): string {
    return this.value.split(" ")[0] ?? this.value;
  }

  toString(): string {
    return this.value;
  }
}
