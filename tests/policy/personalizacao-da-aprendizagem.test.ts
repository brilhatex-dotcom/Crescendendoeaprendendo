import { describe, expect, it } from "vitest";

import { CONFIGURACOES } from "@/app/(guardian)/familia/[learnerId]/personalizacao/configuracoes";
import { REGRAS_DE_DIMENSAO, sugestaoQualificada } from "@/modules/learning-profile";

/**
 * A TELA "PERSONALIZAÇÃO DA APRENDIZAGEM" NUNCA DIAGNOSTICA.
 *
 * Mesma disciplina de `dimension-rules.test.ts` e
 * `accessibility-recommendation.test.ts` — aqui, na última milha: o texto
 * que chega de verdade na tela do responsável, tanto para configuração
 * manual quanto para sugestão gerada pelo Learning Profile.
 */
const PROIBIDAS = ["autis", "tdah", "dislexi", "deficien", "transtorno", "superdotad", "diagnost"];

describe("copy da tela de personalização", () => {
  it("nenhum rótulo ou descrição de configuração manual menciona diagnóstico", () => {
    for (const { campo, rotulo, descricao } of CONFIGURACOES) {
      const texto = `${rotulo} ${descricao}`.toLowerCase();
      for (const termo of PROIBIDAS) {
        expect(texto, `${campo}: "${rotulo}" / "${descricao}"`).not.toContain(termo);
      }
    }
  });

  it("toda dimensão do perfil tem uma configuração manual correspondente", () => {
    // Cada sugestão precisa de um jeito de o responsável desfazer ou refazer
    // manualmente — o "Configurar manualmente" da tela é o mesmo botão que
    // desativa o que uma sugestão ligou.
    const camposConhecidos = new Set(CONFIGURACOES.map((c) => c.campo));
    for (const chave of Object.keys(REGRAS_DE_DIMENSAO)) {
      const sugestao = sugestaoQualificada(chave, 1, 1);
      expect(sugestao, chave).not.toBeNull();
      expect(camposConhecidos.has(sugestao!.settingField as never), chave).toBe(true);
    }
  });
});
