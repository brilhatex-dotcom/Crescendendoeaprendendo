import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { carregarAcervo } from "@/content/loader";

/**
 * TODA PERGUNTA PRECISA SER RESPONDÍVEL.
 *
 * ── Por que este arquivo existe ──
 * A primeira atividade que foi ao ar perguntava *"ORLA encontrou **estas**
 * conchas na areia. Quantas são?"* — e não mostrava concha nenhuma. As opções
 * eram 3, 4 e 5. Uma criança de sete anos abriu a tela e não tinha o que fazer
 * além de chutar.
 *
 * Nenhum teste pegou porque nenhum teste perguntava isso. O schema estava
 * válido, o `evaluate` estava correto, a tela renderizava. Faltava a única
 * pergunta que importava: **dá para responder?**
 *
 * É a classe de defeito mais cara do produto, porque não quebra nada — só
 * ensina a criança que o jogo é chute.
 */

/**
 * Demonstrativo apontando para um objeto.
 *
 * `\b` antes é o que separa "estas conchas" de "destas conchas" e de "qual
 * destes" — nos dois últimos os objetos costumam ser as próprias opções, e
 * exigir apoio daria falso positivo em toda pergunta de comparação.
 */
const APONTA_PARA_ALGO = /\b(esta|este|estas|estes)\s+[a-zà-ú]/i;

describe("errar tem que ensinar, não entregar", () => {
  it("a tela não revela a resposta certa quando a criança pode tentar de novo", () => {
    const fonte = readFileSync(
      join(process.cwd(), "src/activities/renderers/multiple-choice-renderer.tsx"),
      "utf8",
    );

    /*
     * O defeito, quando existia: a criança errava, o `ensino` explicava o que
     * observar, o app pedia "tente de novo" — e a resposta estava ali, com ✓
     * verde. Ela tocava na destacada e passava sem ter contado nada.
     *
     * Toda opção incorreta deste produto é obrigada a trazer `ensino` — o
     * schema não compila sem. Entregar a resposta no mesmo instante joga fora
     * exatamente o que essa obrigação existe para comprar.
     */
    expect(fonte).toContain("revelarACorreta");
    expect(fonte).toContain('detalhes?.acertou === true');
    expect(fonte).toContain("revelarACorreta && detalhes?.opcaoCorreta === opcao.id");
  });
});

describe("uma pergunta que aponta para objetos precisa mostrar os objetos", () => {
  it("nenhuma atividade do acervo aponta para o que não está na tela", async () => {
    const { acervo, problemas } = await carregarAcervo();
    expect(problemas).toEqual([]);

    const impossiveis: string[] = [];

    for (const carregada of acervo.missoes) {
      for (const fase of carregada.missao.fases) {
        for (const atividade of fase.atividades) {
          const config = atividade.config as {
            enunciado?: unknown;
            apoio?: unknown;
            itens?: unknown;
          };

          const enunciado = typeof config.enunciado === "string" ? config.enunciado : "";
          if (!APONTA_PARA_ALGO.test(enunciado)) continue;

          /*
           * `apoio` mostra a cena; `itens` são os próprios objetos manipuláveis
           * (ordenação, arrastar). Qualquer um dos dois torna a pergunta
           * respondível — o que não pode é nenhum.
           */
          const mostraAlgo = config.apoio !== undefined || Array.isArray(config.itens);
          if (mostraAlgo) continue;

          impossiveis.push(
            `${carregada.missao.slug}/${fase.slug}/${atividade.slug}: "${enunciado}"`,
          );
        }
      }
    }

    expect(
      impossiveis,
      "Estas atividades apontam para objetos que a criança não vê. " +
        "Declare `apoio` (ver src/activities/stimulus.ts) ou reescreva o enunciado " +
        "para não depender de algo que não está na tela.",
    ).toEqual([]);
  });

  it("toda coleção declarada tem nome no singular para leitor de tela", async () => {
    const { acervo } = await carregarAcervo();

    for (const carregada of acervo.missoes) {
      for (const fase of carregada.missao.fases) {
        for (const atividade of fase.atividades) {
          const apoio = (atividade.config as { apoio?: unknown }).apoio as
            | { tipo?: string; grupos?: { nome?: string }[] }
            | undefined;

          if (apoio?.tipo !== "colecao") continue;

          for (const grupo of apoio.grupos ?? []) {
            expect(grupo.nome, `${atividade.slug}: grupo sem nome`).toBeTruthy();
            /*
             * O nome é anunciado em cada objeto, um por um, para que uma
             * criança cega conte navegando. Um nome com número dentro
             * ("quatro conchas") entregaria a resposta de graça.
             */
            expect(grupo.nome).not.toMatch(/\d/);
          }
        }
      }
    }
  });
});
