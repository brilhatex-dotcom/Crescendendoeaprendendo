import {
  err,
  notFound,
  ok,
  rateLimited,
  unauthenticated,
  type Result,
} from "@/shared/kernel";

import type { IdentityDeps, RequestContext } from "../deps";
import type { PerfilDeCrianca } from "../ports";
import { DURACAO, LIMITES } from "../policy";
import type { Ator } from "./resolve-session";

export interface SessaoDeCriancaAberta {
  readonly learner: PerfilDeCrianca;
  /** Momento em que a sub-sessão caduca sozinha (4h — docs/09 §2). */
  readonly expiraEm: Date;
}

/**
 * Abre a sub-sessão de criança dentro da sessão adulta.
 *
 * A sessão do adulto **não é substituída**: ela continua no banco, e o que
 * gravamos é `activeLearnerId`. Isso importa porque a saída da área infantil
 * precisa devolver o adulto exatamente onde ele estava, sem novo login.
 *
 * Duas guardas antes de abrir:
 * - a conta precisa ter PIN, senão a porta de saída não tranca;
 * - a criança precisa ser desta família — e o repositório responde `null` tanto
 *   para "não existe" quanto para "é de outra família", de propósito.
 */
export async function iniciarSessaoDeCrianca(
  deps: IdentityDeps,
  ator: Ator,
  learnerId: string,
  ctx: RequestContext,
): Promise<Result<SessaoDeCriancaAberta>> {
  const permitido = ator.account.canManageLearners();
  if (!permitido.ok) return permitido;

  const temPin = ator.account.requireParentPin();
  if (!temPin.ok) return temPin;

  const learner = await deps.learners.findForGuardian(ator.account.id, learnerId);
  if (!learner) {
    return err(notFound("learner.not_found", "Perfil não encontrado nesta família."));
  }

  await deps.sessions.setActiveLearner(ator.sessionId, learner.id);

  await deps.audit.record({
    actorAccountId: ator.account.id,
    action: "identity.learner_session_started",
    entity: "Learner",
    entityId: learner.id,
    metadata: { traceId: ctx.traceId },
  });

  return ok({
    learner,
    expiraEm: new Date(deps.clock.now().getTime() + DURACAO.sessaoCrianca),
  });
}

/**
 * Fecha a área infantil — exige o PIN do responsável.
 *
 * Este é o ponto que ADR 0003 protege: sem ele, a criança que aprendeu a tocar
 * em "sair" chega ao painel com relatórios, assinatura e dados da família. O
 * PIN não é forte contra um atacante; é forte contra quem tem 7 anos, que é
 * exatamente o adversário que existe aqui.
 */
export async function encerrarSessaoDeCrianca(
  deps: IdentityDeps,
  ator: Ator,
  pinInformado: string,
  ctx: RequestContext,
): Promise<Result<void>> {
  if (ator.activeLearnerId === null) return ok(undefined);

  const limite = await deps.rateLimiter.consume(
    `pin:${ator.account.id}`,
    LIMITES.pin.limite,
    LIMITES.pin.janelaMs,
  );
  if (!limite.ok) {
    return err(
      rateLimited(
        "auth.pin_rate_limited",
        "PIN errado várias vezes. Espere um pouco antes de tentar de novo.",
      ),
    );
  }

  const hashGuardado = await deps.accounts.findParentPinHash(ator.account.id);
  if (!hashGuardado) {
    await deps.hasher.fakeVerify();
    return err(unauthenticated("auth.pin_invalid", "PIN incorreto."));
  }

  const confere = await deps.hasher.verify(hashGuardado, pinInformado.trim());
  if (!confere) {
    await deps.audit.record({
      actorAccountId: ator.account.id,
      action: "identity.parent_pin_failed",
      entity: "Account",
      entityId: ator.account.id,
      metadata: { traceId: ctx.traceId },
    });
    return err(unauthenticated("auth.pin_invalid", "PIN incorreto."));
  }

  await deps.sessions.setActiveLearner(ator.sessionId, null);

  await deps.audit.record({
    actorAccountId: ator.account.id,
    action: "identity.learner_session_ended",
    entity: "Learner",
    entityId: ator.activeLearnerId,
    metadata: { traceId: ctx.traceId },
  });

  return ok(undefined);
}
