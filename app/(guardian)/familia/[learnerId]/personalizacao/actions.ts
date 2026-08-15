"use server";

import { z } from "zod";

import { learningProfileGuardianDeps } from "@/composition/learning-profile";
import { identityDeps } from "@/composition/identity";
import {
  atualizarConfiguracoesDoAprendiz,
  obterConfiguracoesDoAprendiz,
} from "@/modules/identity";
import { createAction } from "@/server/action";
import { err, internalError, ok } from "@/shared/kernel";

/**
 * AS DUAS AÇÕES DA TELA "PERSONALIZAÇÃO DA APRENDIZAGEM".
 *
 * Uma para o responsável mudar qualquer configuração de acessibilidade de
 * próprio punho; outra para aceitar ou recusar uma sugestão do Learning
 * Profile. As duas exigem `adulto-verificado` — a mesma barra de
 * `criarPerfilAction`/`definirPinAction`, porque as duas tocam dado de
 * criança (docs/09 §6).
 */

const CAMPOS_BOOLEANOS = [
  "soundEnabled",
  "musicEnabled",
  "reducedMotion",
  "dyslexiaFont",
  "highContrast",
  "textToSpeech",
  "aiTutorEnabled",
  "captionsEnabled",
  "stepByStepInstructions",
  "oneTaskAtATime",
  "pictogramsEnabled",
  "simplifiedInterface",
  "extraTimeEnabled",
] as const;

export const atualizarConfiguracaoAction = createAction({
  nome: "identity.update_learner_setting",
  escopo: "adulto-verificado",
  entrada: z.object({
    learnerId: z.string().min(1).max(60),
    campo: z.enum(CAMPOS_BOOLEANOS),
    valor: z.enum(["true", "false"]),
  }),

  executar: async ({ entrada, ator, ctx }) => {
    if (!ator) return err(internalError("identity.invalid_context", "Contexto incompleto."));

    return atualizarConfiguracoesDoAprendiz(
      identityDeps(),
      ator,
      {
        learnerId: entrada.learnerId,
        alteracoes: { [entrada.campo]: entrada.valor === "true" },
      },
      ctx,
    );
  },
});

export const responderRecomendacaoAction = createAction({
  nome: "learning_profile.respond_recommendation",
  escopo: "adulto-verificado",
  entrada: z.object({
    learnerId: z.string().min(1).max(60),
    recommendationId: z.string().min(1).max(60),
    resposta: z.enum(["aceitar", "recusar"]),
  }),

  executar: async ({ entrada, ator, ctx }) => {
    if (!ator) return err(internalError("identity.invalid_context", "Contexto incompleto."));

    /*
     * A checagem de família tem que vir ANTES de tocar `learning-profile` —
     * uma `Recommendation` não sabe de conta nenhuma, só de `learnerId`.
     * `obterConfiguracoesDoAprendiz` já faz exatamente essa checagem
     * (`findForGuardian`) como primeiro passo; reaproveitá-la aqui evita
     * repetir a consulta fora de um caso de uso público do módulo.
     */
    const posse = await obterConfiguracoesDoAprendiz(identityDeps(), ator, entrada.learnerId);
    if (!posse.ok) return posse;

    const resultado = await learningProfileGuardianDeps().responderRecomendacao({
      learnerId: entrada.learnerId,
      recommendationId: entrada.recommendationId,
      aceitar: entrada.resposta === "aceitar",
    });
    if (!resultado.ok) return resultado;

    // Aceitar aplica a configuração sugerida — nunca aplicada sozinha, e
    // sempre com o mesmo AuditLog de qualquer outra mudança de configuração.
    if (resultado.value.configuracao) {
      const aplicado = await atualizarConfiguracoesDoAprendiz(
        identityDeps(),
        ator,
        {
          learnerId: entrada.learnerId,
          alteracoes: {
            [resultado.value.configuracao.settingField]: resultado.value.configuracao.suggestedValue,
          },
        },
        ctx,
      );
      if (!aplicado.ok) return aplicado;
    }

    return ok({ aceita: resultado.value.aceita });
  },
});
