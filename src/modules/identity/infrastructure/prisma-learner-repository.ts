import type { AgeBand as AgeBandRow, PrismaClient } from "@prisma/client";

import { AVATAR_PADRAO, type AgeBand } from "../domain";
import type {
  LearnerRepository,
  NovoLearner,
  PerfilDeCrianca,
} from "../application/ports";

const SELECAO = {
  id: true,
  displayName: true,
  ageBand: true,
  birthYear: true,
} as const;

export class PrismaLearnerRepository implements LearnerRepository {
  readonly #db: PrismaClient;

  constructor(db: PrismaClient) {
    this.#db = db;
  }

  /**
   * Criança, ajustes de acessibilidade e vínculo de guarda nascem juntos, numa
   * transação só.
   *
   * Não é zelo excessivo: uma `Learner` sem `GuardianLink` é uma criança sem
   * responsável — invisível no seletor da família e fora do alcance de
   * qualquer política de acesso, porque toda autorização daqui pra frente
   * pergunta "quem é o guardião?". Meio caminho aqui é dado órfão.
   *
   * `LearnerSettings` vem com o padrão do schema, que já é o padrão acessível
   * (texto falado ligado em SPROUT — Bíblia Cap. 1 V6).
   */
  async create(dados: NovoLearner): Promise<PerfilDeCrianca> {
    return this.#db.$transaction(async (tx) => {
      const learner = await tx.learner.create({
        data: {
          displayName: dados.displayName,
          birthYear: dados.birthYear,
          ageBand: dados.ageBand as AgeBandRow,
          locale: dados.locale,
          avatarConfig: AVATAR_PADRAO,
          settings: { create: {} },
          guardians: {
            create: {
              accountId: dados.guardianAccountId,
              relation: dados.relation,
              // Quem cria é o responsável principal por padrão. Uma segunda
              // conta pode ser vinculada depois, sem herdar essa marca.
              isPrimary: true,
            },
          },
        },
        select: SELECAO,
      });

      return { ...learner, ageBand: learner.ageBand as AgeBand };
    });
  }

  async listByGuardian(accountId: string): Promise<readonly PerfilDeCrianca[]> {
    const linhas = await this.#db.learner.findMany({
      where: { deletedAt: null, guardians: { some: { accountId } } },
      select: SELECAO,
      orderBy: { createdAt: "asc" },
    });
    return linhas.map((linha) => ({ ...linha, ageBand: linha.ageBand as AgeBand }));
  }

  /**
   * O vínculo de guarda entra no `where`, não numa checagem depois da consulta.
   * Assim "não existe" e "existe, mas é de outra família" devolvem exatamente
   * a mesma coisa — e nenhum caminho novo pode esquecer de filtrar.
   */
  async findForGuardian(
    accountId: string,
    learnerId: string,
  ): Promise<PerfilDeCrianca | null> {
    const linha = await this.#db.learner.findFirst({
      where: {
        id: learnerId,
        deletedAt: null,
        guardians: { some: { accountId } },
      },
      select: SELECAO,
    });
    return linha ? { ...linha, ageBand: linha.ageBand as AgeBand } : null;
  }

  async countByGuardian(accountId: string): Promise<number> {
    return this.#db.learner.count({
      where: { deletedAt: null, guardians: { some: { accountId } } },
    });
  }
}
