import { evidenciaSuficiente } from "./dimension";

/**
 * RECOMENDAÇÃO DE ACESSIBILIDADE — a dimensão do perfil vira uma sugestão
 * concreta para o responsável, nunca um diagnóstico.
 *
 * Mesmo espírito de `domain/dimension-rules.ts`: um mapeamento pequeno e
 * deliberadamente extensível — uma dimensão nova que mereça virar sugestão é
 * uma linha nova aqui, nunca uma migration. `settingField` é sempre um nome
 * de coluna de `LearnerSettings` (a camada de acessibilidade que já existe,
 * independente de diagnóstico — docs/HANDOFF.md, Fase 0) — nunca um rótulo
 * de condição médica ou psicológica.
 *
 * `reason` é a única prosa que o responsável vê: fala de padrão observado,
 * nunca de causa, e sempre com o lembrete de que não é diagnóstico
 * (`Recommendation.reason`, `prisma/schema.prisma`: "explicável ao
 * responsável").
 */
export interface SugestaoDeAcessibilidade {
  readonly dimensionKey: string;
  readonly settingField: string;
  readonly reason: string;
}

const RECOMENDACAO_POR_DIMENSAO: Readonly<
  Record<string, Omit<SugestaoDeAcessibilidade, "dimensionKey">>
> = {
  suporteVisual: {
    settingField: "pictogramsEnabled",
    reason:
      "Nas últimas atividades, esta criança pareceu se sair melhor quando havia imagens ou " +
      "ícones junto da pergunta. Isso não é um diagnóstico — é só um padrão observado. Ativar " +
      "deixa esse apoio visual presente com mais frequência.",
  },
  instrucaoPassoAPasso: {
    settingField: "stepByStepInstructions",
    reason:
      "Nas últimas atividades, esta criança pareceu se sair melhor quando as instruções vinham " +
      "divididas em passos curtos, em vez de um texto só. Isso não é um diagnóstico — é só um " +
      "padrão observado. Ativar deixa as instruções divididas em passos com mais frequência.",
  },
  independenciaDeLeitura: {
    settingField: "textToSpeech",
    reason:
      "Nas últimas atividades, esta criança pareceu se sair melhor quando não precisava ler " +
      "sozinha. Isso não é um diagnóstico — é só um padrão observado. Ativar liga a leitura em " +
      "voz alta das perguntas.",
  },
};

/**
 * A dimensão tem uma sugestão mapeada, e a evidência já é forte o bastante
 * para valer a pena mostrar (mesmo limiar de `escolherApresentacao`, Fase
 * 3a — nunca duas respostas diferentes para "há evidência suficiente?").
 * Sem isso, `null`: nem toda dimensão vira sugestão, e nenhuma vira cedo
 * demais.
 */
export function sugestaoQualificada(
  dimensionKey: string,
  confidence: number,
  value: number,
): SugestaoDeAcessibilidade | null {
  const regra = RECOMENDACAO_POR_DIMENSAO[dimensionKey];
  if (!regra) return null;
  if (!evidenciaSuficiente(confidence, value)) return null;
  return { dimensionKey, ...regra };
}
