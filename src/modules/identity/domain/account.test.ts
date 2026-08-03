import { describe, expect, it } from "vitest";

import { Account, type AccountStatus } from "./account";
import { Email } from "./email";
import { isErr, unwrap } from "@/shared/kernel";

const AGORA = new Date("2026-08-03T12:00:00.000Z");

function conta(
  overrides: Partial<{
    status: AccountStatus;
    emailVerifiedAt: Date | null;
    hasParentPin: boolean;
  }> = {},
): Account {
  return Account.rehydrate({
    id: "acc_1",
    email: unwrap(Email.create("mariana@exemplo.com")),
    name: "Mariana",
    locale: "pt-BR",
    hasPassword: true,
    hasParentPin: overrides.hasParentPin ?? true,
    status: overrides.status ?? "ACTIVE",
    emailVerifiedAt:
      overrides.emailVerifiedAt === undefined ? AGORA : overrides.emailVerifiedAt,
  });
}

describe("Account — verificação de e-mail", () => {
  it("ativa a conta e registra o evento", () => {
    const account = conta({ status: "PENDING_VERIFICATION", emailVerifiedAt: null });

    expect(account.verifyEmail(AGORA, "trace-1").ok).toBe(true);
    expect(account.status).toBe("ACTIVE");
    expect(account.emailVerifiedAt).toEqual(AGORA);

    const eventos = account.pullEvents();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.name).toBe("identity.account_verified");
  });

  it("é idempotente — clicar duas vezes no link não é erro nem gera evento novo", () => {
    const account = conta({ status: "PENDING_VERIFICATION", emailVerifiedAt: null });
    account.verifyEmail(AGORA, "trace-1");
    account.pullEvents();

    const segunda = account.verifyEmail(new Date("2026-08-04T12:00:00.000Z"), "trace-2");

    expect(segunda.ok).toBe(true);
    expect(account.emailVerifiedAt).toEqual(AGORA);
    expect(account.pullEvents()).toHaveLength(0);
  });

  it("não verifica conta suspensa nem excluída", () => {
    expect(isErr(conta({ status: "SUSPENDED" }).verifyEmail(AGORA, "t"))).toBe(true);
    expect(isErr(conta({ status: "DELETED" }).verifyEmail(AGORA, "t"))).toBe(true);
  });
});

describe("Account — entrada", () => {
  it("deixa entrar mesmo sem e-mail verificado", () => {
    // Bloquear aqui deixaria quem perdeu o e-mail sem caminho para reenviá-lo.
    const account = conta({ status: "PENDING_VERIFICATION", emailVerifiedAt: null });
    expect(account.canSignIn().ok).toBe(true);
  });

  it("recusa conta suspensa com motivo explícito", () => {
    const resultado = conta({ status: "SUSPENDED" }).canSignIn();
    expect(isErr(resultado) && resultado.error.code).toBe("account.suspended");
  });

  it("responde a conta excluída como credencial inválida (anti-enumeração)", () => {
    const resultado = conta({ status: "DELETED" }).canSignIn();
    expect(isErr(resultado) && resultado.error.code).toBe("auth.invalid_credentials");
  });
});

describe("Account — gestão de crianças", () => {
  it("exige e-mail verificado antes de existir dado de criança", () => {
    const account = conta({ status: "PENDING_VERIFICATION", emailVerifiedAt: null });
    const resultado = account.canManageLearners();
    expect(isErr(resultado) && resultado.error.code).toBe("account.email_not_verified");
  });

  it("libera conta ativa e verificada", () => {
    expect(conta().canManageLearners().ok).toBe(true);
  });

  it("exige PIN definido para abrir a área infantil", () => {
    const resultado = conta({ hasParentPin: false }).requireParentPin();
    expect(isErr(resultado) && resultado.error.code).toBe("account.pin_not_set");
    expect(conta({ hasParentPin: true }).requireParentPin().ok).toBe(true);
  });
});
