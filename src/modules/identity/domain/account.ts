import {
  AggregateRoot,
  conflict,
  domainEvent,
  err,
  forbidden,
  ok,
  unauthenticated,
  type Result,
} from "@/shared/kernel";

import { Email } from "./email";

export type AccountStatus =
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "SUSPENDED"
  | "DELETED";

export interface AccountState {
  readonly id: string;
  readonly email: Email;
  readonly name: string;
  readonly status: AccountStatus;
  readonly emailVerifiedAt: Date | null;
  readonly hasPassword: boolean;
  readonly hasParentPin: boolean;
  readonly locale: string;
}

/**
 * Conta de **adulto responsável**. Criança nunca é Account (ADR 0003).
 *
 * A entidade guarda as decisões que não podem divergir entre os pontos de
 * entrada: se uma conta pode entrar, se pode receber verificação de novo, se já
 * está apta a criar perfil de criança. Espalhar esses `if` entre server action,
 * middleware e página é como essas regras acabam contraditórias.
 */
export class Account extends AggregateRoot {
  readonly id: string;
  readonly email: Email;
  readonly name: string;
  readonly locale: string;
  readonly hasPassword: boolean;
  readonly hasParentPin: boolean;

  #status: AccountStatus;
  #emailVerifiedAt: Date | null;

  private constructor(state: AccountState) {
    super();
    this.id = state.id;
    this.email = state.email;
    this.name = state.name;
    this.locale = state.locale;
    this.hasPassword = state.hasPassword;
    this.hasParentPin = state.hasParentPin;
    this.#status = state.status;
    this.#emailVerifiedAt = state.emailVerifiedAt;
  }

  /** Reconstrói a partir do repositório. Não dispara eventos. */
  static rehydrate(state: AccountState): Account {
    return new Account(state);
  }

  get status(): AccountStatus {
    return this.#status;
  }

  get emailVerifiedAt(): Date | null {
    return this.#emailVerifiedAt;
  }

  get isEmailVerified(): boolean {
    return this.#emailVerifiedAt !== null;
  }

  /**
   * Verificar e-mail é idempotente de propósito: o responsável clica no link
   * duas vezes, ou o antivírus do provedor pré-visita a URL antes dele. Nenhum
   * desses casos é erro — só não geram evento outra vez.
   */
  verifyEmail(agora: Date, traceId: string): Result<void> {
    if (this.#status === "DELETED") {
      return err(forbidden("account.deleted", "Esta conta foi excluída."));
    }
    if (this.#status === "SUSPENDED") {
      return err(forbidden("account.suspended", "Esta conta está suspensa."));
    }
    if (this.isEmailVerified) return ok(undefined);

    this.#emailVerifiedAt = agora;
    this.#status = "ACTIVE";
    this.record(
      domainEvent(
        "identity.account_verified",
        { accountId: this.id },
        traceId,
        agora,
      ),
    );
    return ok(undefined);
  }

  /**
   * Pode iniciar sessão?
   *
   * Conta não verificada **entra** — e cai numa tela pedindo a verificação.
   * Bloquear o login aqui seria pior: o responsável que perdeu o e-mail ficaria
   * sem nenhum caminho para reenviá-lo, já que reenviar exige saber quem é.
   * O que a conta não verificada não pode fazer é criar perfil de criança.
   */
  canSignIn(): Result<void> {
    switch (this.#status) {
      case "ACTIVE":
      case "PENDING_VERIFICATION":
        return ok(undefined);
      case "SUSPENDED":
        return err(
          forbidden(
            "account.suspended",
            "Esta conta está suspensa. Fale com o suporte.",
          ),
        );
      case "DELETED":
        // Mensagem igual à de credencial errada: quem sonda não descobre que a conta existiu.
        return err(
          unauthenticated("auth.invalid_credentials", "E-mail ou senha incorretos."),
        );
    }
  }

  /**
   * Barreira do consentimento parental (docs/09 §6): dado de criança só nasce
   * depois que provamos que o e-mail do adulto é dele mesmo.
   */
  canManageLearners(): Result<void> {
    if (!this.isEmailVerified) {
      return err(
        forbidden(
          "account.email_not_verified",
          "Confirme seu e-mail antes de criar o perfil da criança.",
        ),
      );
    }
    return this.canSignIn();
  }

  /**
   * Sair da área infantil exige PIN. Conta sem PIN definido não pode ter
   * sub-sessão de criança — senão a "porta trancada" seria uma porta encostada.
   */
  requireParentPin(): Result<void> {
    if (!this.hasParentPin) {
      return err(
        conflict(
          "account.pin_not_set",
          "Defina um PIN de responsável antes de abrir a área da criança.",
        ),
      );
    }
    return ok(undefined);
  }
}
