import { err, ok, validationError, type Result } from "@/shared/kernel";

/**
 * PIN do responsável — o portão entre a área infantil e a área adulta.
 *
 * ADR 0003: a criança escolhe o próprio perfil sozinha, mas **sair** da área
 * infantil exige o PIN. Ele não protege contra um adulto mal-intencionado;
 * protege contra a criança de 7 anos que descobriu onde ficam os relatórios e
 * a assinatura. O adversário aqui é curiosidade, não criptanálise — por isso
 * 4 dígitos bastam, desde que não sejam adivinháveis em três tentativas.
 */
export class ParentPin {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static create(input: string): Result<ParentPin> {
    const digitos = input.trim();

    if (!/^\d{4,6}$/.test(digitos)) {
      return err(
        validationError("pin.format", "O PIN precisa ter de 4 a 6 dígitos numéricos."),
      );
    }

    if (/^(\d)\1+$/.test(digitos)) {
      return err(
        validationError(
          "pin.repeated",
          "Um PIN de dígitos iguais é o primeiro que uma criança tenta.",
        ),
      );
    }

    if (ehSequencia(digitos)) {
      return err(
        validationError(
          "pin.sequential",
          "Um PIN em sequência é o segundo que uma criança tenta.",
        ),
      );
    }

    return ok(new ParentPin(digitos));
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return "[pin omitido]";
  }

  toJSON(): string {
    return "[pin omitido]";
  }
}

/** Cobre 1234 e 4321 — subida e descida, passo de 1. */
function ehSequencia(digitos: string): boolean {
  const passos = new Set<number>();
  for (let i = 1; i < digitos.length; i += 1) {
    passos.add(Number(digitos[i]) - Number(digitos[i - 1]));
  }
  return passos.size === 1 && (passos.has(1) || passos.has(-1));
}
