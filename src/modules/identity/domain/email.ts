import { err, ok, validationError, type Result } from "@/shared/kernel";

/**
 * E-mail como Value Object.
 *
 * Existe para que o resto do sistema não precise se perguntar se a string que
 * recebeu já foi validada e normalizada. Um `Email` só existe se for válido.
 */
export class Email {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Deliberadamente permissivo na forma e rígido no formato geral: a única
   * prova real de que um endereço existe é o e-mail de verificação chegar.
   * Regex elaborada aqui só rejeitaria endereços legítimos e incomuns.
   */
  static create(input: string): Result<Email> {
    const normalizado = input.trim().toLowerCase();

    if (normalizado.length === 0) {
      return err(validationError("email.empty", "Informe um e-mail."));
    }
    if (normalizado.length > 254) {
      return err(
        validationError("email.too_long", "E-mail longo demais (máximo 254 caracteres)."),
      );
    }
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(normalizado)) {
      return err(validationError("email.malformed", "Este e-mail não parece válido."));
    }

    return ok(new Email(normalizado));
  }

  /** Parte local mascarada, para exibir sem expor o endereço inteiro. */
  get masked(): string {
    const [local = "", dominio = ""] = this.value.split("@");
    const visivel = local.slice(0, 2);
    return `${visivel}${"•".repeat(Math.max(local.length - 2, 1))}@${dominio}`;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
