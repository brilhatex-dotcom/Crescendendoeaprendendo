import { hashToken } from "@/shared/security/tokens";

import type { Account } from "../../domain";
import type { IdentityDeps } from "../deps";

/**
 * Quem está agindo, resolvido a partir do cookie.
 *
 * `activeLearnerId` diferente de null significa que a sub-sessão de criança
 * está em vigor. Nesse estado a sessão **continua sendo a do adulto** — o que
 * muda é o escopo permitido, checado em cada caso de uso (docs/09 §2).
 */
export interface Ator {
  readonly account: Account;
  readonly sessionId: string;
  readonly activeLearnerId: string | null;
}

/**
 * Traduz token de sessão em ator, ou null.
 *
 * Chamada em toda requisição autenticada, então evita trabalho desnecessário:
 * o repositório já filtra sessão expirada e revogada na consulta, em vez de
 * trazer tudo e decidir aqui.
 */
export async function resolverSessao(
  deps: IdentityDeps,
  sessionToken: string | null,
): Promise<Ator | null> {
  if (!sessionToken) return null;

  const sessao = await deps.sessions.findLiveByTokenHash(
    hashToken(sessionToken),
    deps.clock.now(),
  );
  if (!sessao) return null;

  const account = await deps.accounts.findById(sessao.accountId);
  if (!account) return null;

  // Conta suspensa ou excluída depois do login não pode continuar navegando
  // com um cookie ainda válido.
  if (!account.canSignIn().ok) return null;

  return {
    account,
    sessionId: sessao.id,
    activeLearnerId: sessao.activeLearnerId,
  };
}
