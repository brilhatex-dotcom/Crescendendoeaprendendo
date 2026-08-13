import type { Account as AccountRow, PrismaClient } from "@prisma/client";

import { unwrap } from "@/shared/kernel";

import { Account, Email, type AccountStatus } from "../domain";
import type { AccountRepository, NovaConta } from "../application/ports";

/**
 * Tradução entre a linha do banco e a entidade de domínio.
 *
 * O `unwrap` no e-mail é seguro e proposital: um endereço só chega ao banco
 * depois de passar pelo Value Object. Se falhasse aqui, seria corrupção de
 * dados — e falhar alto é a resposta certa, não seguir com um e-mail inválido.
 */
function paraDominio(linha: AccountRow): Account {
  return Account.rehydrate({
    id: linha.id,
    email: unwrap(Email.create(linha.email)),
    name: linha.name,
    locale: linha.locale,
    hasPassword: linha.passwordHash !== null,
    hasParentPin: linha.parentPinHash !== null,
    status: linha.status as AccountStatus,
    emailVerifiedAt: linha.emailVerifiedAt,
  });
}

/** Conta excluída (soft delete) não existe para nenhuma consulta de leitura. */
const VIVA = { deletedAt: null } as const;

export class PrismaAccountRepository implements AccountRepository {
  readonly #db: PrismaClient;

  constructor(db: PrismaClient) {
    this.#db = db;
  }

  async findByEmail(email: Email): Promise<Account | null> {
    const linha = await this.#db.account.findFirst({
      where: { email: email.value, ...VIVA },
    });
    return linha ? paraDominio(linha) : null;
  }

  async findById(id: string): Promise<Account | null> {
    const linha = await this.#db.account.findFirst({ where: { id, ...VIVA } });
    return linha ? paraDominio(linha) : null;
  }

  async findPasswordHash(accountId: string): Promise<string | null> {
    const linha = await this.#db.account.findFirst({
      where: { id: accountId, ...VIVA },
      select: { passwordHash: true },
    });
    return linha?.passwordHash ?? null;
  }

  async findParentPinHash(accountId: string): Promise<string | null> {
    const linha = await this.#db.account.findFirst({
      where: { id: accountId, ...VIVA },
      select: { parentPinHash: true },
    });
    return linha?.parentPinHash ?? null;
  }

  async create(dados: NovaConta): Promise<Account> {
    const linha = await this.#db.account.create({
      data: {
        email: dados.email.value,
        name: dados.nome,
        passwordHash: dados.passwordHash,
        locale: dados.locale,
        status: "PENDING_VERIFICATION",
        // Cada responsável nasce com o papel GUARDIAN no escopo da própria
        // família (organizationId nulo). RBAC sem permissão global implícita.
        roles: { create: { role: "GUARDIAN" } },
      },
    });
    return paraDominio(linha);
  }

  async markEmailVerified(accountId: string, quando: Date): Promise<void> {
    await this.#db.account.update({
      where: { id: accountId },
      data: { emailVerifiedAt: quando, status: "ACTIVE" },
    });
  }

  async updateParentPin(accountId: string, pinHash: string): Promise<void> {
    await this.#db.account.update({
      where: { id: accountId },
      data: { parentPinHash: pinHash },
    });
  }

  async updatePasswordHash(accountId: string, passwordHash: string): Promise<void> {
    await this.#db.account.update({
      where: { id: accountId },
      data: { passwordHash },
    });
  }

  async registerLogin(accountId: string, quando: Date): Promise<void> {
    await this.#db.account.update({
      where: { id: accountId },
      data: { lastLoginAt: quando },
    });
  }
}
