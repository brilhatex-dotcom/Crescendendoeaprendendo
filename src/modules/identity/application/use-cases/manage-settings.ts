import { err, notFound, ok, type Result } from "@/shared/kernel";

import type { IdentityDeps, RequestContext } from "../deps";
import type { ConfiguracoesDoAprendiz } from "../ports";
import type { Ator } from "./resolve-session";

/**
 * `LearnerSettings` de uma criança — para a tela "Personalização da
 * Aprendizagem" do responsável.
 *
 * A verificação de família acontece na consulta que já existe
 * (`findForGuardian`, mesmo padrão de `criarPerfilDeCrianca`): "não existe" e
 * "existe, mas é de outra família" devolvem exatamente o mesmo erro, então
 * nenhum caminho novo pode vazar a diferença.
 */
export async function obterConfiguracoesDoAprendiz(
  deps: IdentityDeps,
  ator: Ator,
  learnerId: string,
): Promise<Result<ConfiguracoesDoAprendiz>> {
  const crianca = await deps.learners.findForGuardian(ator.account.id, learnerId);
  if (!crianca) {
    return err(notFound("identity.learner_not_found", "Esta criança não foi encontrada."));
  }

  const configuracoes = await deps.learners.obterConfiguracoes(learnerId);
  if (!configuracoes) {
    return err(
      notFound("identity.settings_not_found", "Configurações desta criança não encontradas."),
    );
  }

  return ok(configuracoes);
}

export interface AtualizarConfiguracoesInput {
  readonly learnerId: string;
  readonly alteracoes: Partial<ConfiguracoesDoAprendiz>;
}

/**
 * Muda uma ou mais configurações de acessibilidade — de próprio punho, ou
 * aceitando uma sugestão de `learning-profile` (Fase 3b). Os dois caminhos
 * passam por aqui, e os dois são registrados em `AuditLog` (docs/08 §10:
 * "toda alteração é registrada... e informada à criança de forma neutra").
 */
export async function atualizarConfiguracoesDoAprendiz(
  deps: IdentityDeps,
  ator: Ator,
  input: AtualizarConfiguracoesInput,
  ctx: RequestContext,
): Promise<Result<void>> {
  const crianca = await deps.learners.findForGuardian(ator.account.id, input.learnerId);
  if (!crianca) {
    return err(notFound("identity.learner_not_found", "Esta criança não foi encontrada."));
  }

  await deps.learners.atualizarConfiguracoes(input.learnerId, input.alteracoes);

  await deps.audit.record({
    actorAccountId: ator.account.id,
    action: "identity.learner_settings_updated",
    entity: "LearnerSettings",
    entityId: input.learnerId,
    metadata: { traceId: ctx.traceId, alteracoes: input.alteracoes },
  });

  return ok(undefined);
}
