import { conflict, err, ok, type Result } from "@/shared/kernel";

import { DisplayName, ParentPin, resolverFaixaEtaria } from "../../domain";
import type { IdentityDeps, RequestContext } from "../deps";
import type { PerfilDeCrianca } from "../ports";
import { LIMITES } from "../policy";
import type { Ator } from "./resolve-session";

export interface CriarPerfilInput {
  readonly displayName: string;
  readonly birthYear: number;
  /** "mãe", "pai", "responsável"… texto livre curto, escolhido pelo adulto. */
  readonly relation: string;
}

/**
 * Cria o perfil da criança dentro da conta do responsável.
 *
 * ADR 0003 em uma linha: **a criança não ganha conta, ganha lugar**. Não há
 * e-mail, não há senha, não há como essa criança existir fora desta família.
 *
 * A verificação de e-mail é pré-requisito, e não por burocracia: é a base legal
 * do consentimento parental (docs/09 §6). Antes de provar que o adulto é dono
 * do endereço, não criamos nenhum dado de criança.
 */
export async function criarPerfilDeCrianca(
  deps: IdentityDeps,
  ator: Ator,
  input: CriarPerfilInput,
  ctx: RequestContext,
): Promise<Result<PerfilDeCrianca>> {
  const permitido = ator.account.canManageLearners();
  if (!permitido.ok) return permitido;

  const apelido = DisplayName.create(input.displayName);
  if (!apelido.ok) return apelido;

  const faixa = resolverFaixaEtaria(input.birthYear, deps.clock.now());
  if (!faixa.ok) return faixa;

  const relacao = input.relation.trim();
  if (relacao.length === 0 || relacao.length > 40) {
    return err(
      conflict(
        "learner.relation_invalid",
        "Diga em poucas palavras quem você é para a criança (mãe, pai, avó…).",
      ),
    );
  }

  const quantas = await deps.learners.countByGuardian(ator.account.id);
  if (quantas >= LIMITES.criancasPorConta) {
    return err(
      conflict(
        "learner.too_many",
        `Uma conta familiar comporta até ${LIMITES.criancasPorConta} crianças.`,
      ),
    );
  }

  const perfil = await deps.learners.create({
    guardianAccountId: ator.account.id,
    displayName: apelido.value.value,
    birthYear: input.birthYear,
    ageBand: faixa.value.ageBand,
    locale: ator.account.locale,
    relation: relacao,
  });

  await deps.audit.record({
    actorAccountId: ator.account.id,
    action: "identity.learner_created",
    entity: "Learner",
    entityId: perfil.id,
    // Sem apelido nem ano de nascimento: auditoria não é lugar de dado de criança.
    metadata: { traceId: ctx.traceId, ageBand: faixa.value.ageBand },
  });

  return ok(perfil);
}

/** Perfis da família, para o seletor de `/familia`. */
export async function listarFamilia(
  deps: IdentityDeps,
  ator: Ator,
): Promise<Result<readonly PerfilDeCrianca[]>> {
  const permitido = ator.account.canSignIn();
  if (!permitido.ok) return permitido;
  return ok(await deps.learners.listByGuardian(ator.account.id));
}

/**
 * Define ou troca o PIN do responsável.
 *
 * Sem PIN não existe área infantil: `iniciarSessaoDeCrianca` recusa. É o
 * cadeado da porta de saída (ADR 0003).
 */
export async function definirPinDoResponsavel(
  deps: IdentityDeps,
  ator: Ator,
  pinBruto: string,
  ctx: RequestContext,
): Promise<Result<void>> {
  const permitido = ator.account.canManageLearners();
  if (!permitido.ok) return permitido;

  const pin = ParentPin.create(pinBruto);
  if (!pin.ok) return pin;

  await deps.accounts.updateParentPin(
    ator.account.id,
    await deps.hasher.hash(pin.value.reveal()),
  );

  await deps.audit.record({
    actorAccountId: ator.account.id,
    action: "identity.parent_pin_set",
    entity: "Account",
    entityId: ator.account.id,
    metadata: { traceId: ctx.traceId },
  });

  return ok(undefined);
}
