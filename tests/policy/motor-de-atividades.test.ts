import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PLUGINS_REGISTRADOS,
  avaliarAtividade,
  calcularPremio,
  premioSchema,
  regraDeRecompensaSchema,
  registroPadrao,
  type EvaluationContext,
} from "@/activities";
import { carregarAcervo } from "@/content/loader";
import { unwrap } from "@/shared/kernel";

/**
 * TESTES DE POLÍTICA DO MOTOR DE ATIVIDADES
 *
 * "Estas proibições são verificadas por testes automatizados que quebram o
 *  build — não confiamos apenas na disciplina do time."
 *  — Bíblia Vol. 1, Cap. 1 §1.6 (PG2)
 *
 * Aqui não se testa se o código funciona. Testa-se se ele continua sendo o
 * produto que decidimos construir.
 */

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 5000,
  locale: "pt-BR",
};

/**
 * Respostas erradas plausíveis, por tipo de atividade.
 *
 * Quem adiciona um plugin novo precisa ensinar a este mapa como errar naquele
 * tipo. Não é burocracia: sem isso, o teste abaixo passaria por omissão, e a
 * regra mais importante do produto deixaria de ser verificada justamente no
 * tipo mais novo — o menos testado de todos.
 */
const RESPOSTAS_ERRADAS: Readonly<Record<string, (config: unknown) => unknown[]>> = {
  MULTIPLE_CHOICE: (config) => {
    const c = config as { opcoes: { id: string; correta: boolean }[] };
    return c.opcoes.filter((o) => !o.correta).map((o) => ({ opcaoId: o.id }));
  },
  ORDER_SEQUENCE: (config) => {
    const c = config as { ordemCorreta: string[] };
    return [
      { ordem: [...c.ordemCorreta].reverse() },
      { ordem: [...c.ordemCorreta].slice(1) },
      { ordem: [c.ordemCorreta[c.ordemCorreta.length - 1], ...c.ordemCorreta.slice(0, -1)] },
    ];
  },
  DRAG_MATCH: (config) => {
    const c = config as { pares: { id: string }[] };
    const ids = c.pares.map((p) => p.id);
    // Desloca cada esquerda uma posição à frente na direita: com ids
    // distintos (garantido pelo schema) e ao menos 2 pares, nenhum par
    // combina consigo mesmo — todo par erra.
    const deslocado = Object.fromEntries(ids.map((id, i) => [id, ids[(i + 1) % ids.length]]));
    // Troca só o primeiro par com o segundo — os demais, se houver, ficam
    // certos; prova que crédito parcial também nunca sai sem ensino.
    const trocaParcial = { ...Object.fromEntries(ids.map((id) => [id, id])), [ids[0]!]: ids[1]!, [ids[1]!]: ids[0]! };
    return [{ pareamentos: deslocado }, { pareamentos: trocaParcial }];
  },
  MULTI_SELECT: (config) => {
    const c = config as { opcoes: { id: string; correta: boolean }[] };
    const corretas = c.opcoes.filter((o) => o.correta).map((o) => o.id);
    const incorretas = c.opcoes.filter((o) => !o.correta).map((o) => o.id);
    return [
      { opcaoIds: incorretas }, // nenhuma certa marcada — o pior caso
      { opcaoIds: corretas.slice(0, -1) }, // faltou uma certa — crédito parcial também nunca sai sem ensino
    ];
  },
  TRUE_FALSE: (config) => {
    const c = config as { correta: boolean };
    return [{ resposta: !c.correta }]; // a única resposta errada possível
  },
  FILL_BLANK: (config) => {
    const c = config as { opcoes: { id: string; correta: boolean }[] };
    return c.opcoes.filter((o) => !o.correta).map((o) => ({ opcaoId: o.id }));
  },
  NUMBER_LINE: (config) => {
    const c = config as { minimo: number; maximo: number; valorCorreto: number };
    const extremo = c.valorCorreto === c.minimo ? c.maximo : c.minimo;
    const vizinho = c.valorCorreto + (c.valorCorreto < c.maximo ? 1 : -1);
    return [{ valor: extremo }, { valor: vizinho }];
  },
  WORD_BUILD: (config) => {
    const c = config as { sequenciaCorreta: string[]; pedacos: { id: string }[] };
    const isca = c.pedacos.map((p) => p.id).find((id) => !c.sequenciaCorreta.includes(id));
    return [
      { sequencia: [...c.sequenciaCorreta].reverse() },
      { sequencia: c.sequenciaCorreta.slice(1) },
      // Isca no meio, quando o conteúdo declarou uma — prova que tocar num
      // pedaço que não pertence à palavra também nunca sai sem ensino.
      ...(isca ? [{ sequencia: [c.sequenciaCorreta[0]!, isca, ...c.sequenciaCorreta.slice(1)] }] : []),
    ];
  },
};

describe("PP5 · Erro sempre ensina (docs/08 §12.3)", () => {
  it("todo plugin registrado sabe como ser errado neste teste", () => {
    // Forçar quem cria um plugin a declarar como errá-lo é o que impede este
    // arquivo de virar decoração conforme a plataforma cresce.
    const semCobertura = registroPadrao
      .tiposDisponiveis()
      .filter((tipo) => !RESPOSTAS_ERRADAS[tipo]);

    expect(
      semCobertura,
      `Adicione respostas erradas para ${semCobertura.join(", ")} em RESPOSTAS_ERRADAS.`,
    ).toEqual([]);
  });

  it("nenhuma resposta errada, em todo o acervo, sai sem explicação", async () => {
    const { acervo } = await carregarAcervo();
    let avaliacoes = 0;

    for (const { missao, caminho } of acervo.missoes) {
      for (const fase of missao.fases) {
        for (const atividade of fase.atividades) {
          const gerar = RESPOSTAS_ERRADAS[atividade.tipo];
          if (!gerar) continue;

          for (const resposta of gerar(atividade.config)) {
            const resultado = unwrap(
              avaliarAtividade(
                registroPadrao,
                { type: atividade.tipo, config: atividade.config },
                resposta,
                CTX,
              ),
            );
            avaliacoes += 1;

            if (resultado.outcome === "CORRECT" || resultado.outcome === "SKIPPED") continue;

            const onde = `${caminho} → ${atividade.slug}`;
            expect(resultado.feedback, onde).toBeDefined();
            expect(resultado.feedback.ensino.trim().length, onde).toBeGreaterThan(0);
          }
        }
      }
    }

    // Guarda contra o teste que "passa" porque não avaliou nada.
    expect(avaliacoes).toBeGreaterThan(0);
  });

  it("nenhuma devolutiva de acerto usa palavra de punição", () => {
    // O léxico importa: "errado" não existe no mundo da criança (Bíblia Cap. 3 §3.5).
    const proibidas = ["errado", "errada", "incorreto", "incorreta", "falhou"];

    for (const proibida of proibidas) {
      expect(
        JSON.stringify(RESPOSTAS_ERRADAS).toLowerCase().includes(proibida),
      ).toBe(false);
    }
  });
});

describe("Fôlego jamais impede aprender (docs/08 §4 · Bíblia Cap. 6 §6.4)", () => {
  const regra = regraDeRecompensaSchema.parse({
    porDesfecho: {
      CORRECT: premioSchema.parse({ xp: 10, moedas: 5, itens: ["chapeu"] }),
      PARTIAL: premioSchema.parse({ xp: 6 }),
      INCORRECT: premioSchema.parse({ xp: 4 }),
    },
  });

  it("sem energia, o XP continua integral", () => {
    const semFolego = calcularPremio(regra, {
      outcome: "CORRECT",
      dicasUsadas: 0,
      repeticoes: 0,
      dificuldadeDaAtividade: 1000,
      habilidadeDaCrianca: 1000,
      semFolego: true,
    });

    expect(semFolego.xp).toBe(10);
  });

  it("sem energia, só o cosmético e a moeda são retidos", () => {
    const semFolego = calcularPremio(regra, {
      outcome: "CORRECT",
      dicasUsadas: 0,
      repeticoes: 0,
      dificuldadeDaAtividade: 1000,
      habilidadeDaCrianca: 1000,
      semFolego: true,
    });

    expect(semFolego.moedas).toBe(0);
    expect(semFolego.itens).toEqual([]);
  });

  it("errar nunca paga zero de XP em conteúdo real", async () => {
    const { acervo } = await carregarAcervo();

    for (const { missao, caminho } of acervo.missoes) {
      for (const fase of missao.fases) {
        for (const atividade of fase.atividades) {
          if (!atividade.recompensa) continue;
          const premio = atividade.recompensa.porDesfecho.INCORRECT;
          expect(premio.xp, `${caminho} → ${atividade.slug}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("Integridade do motor", () => {
  it("nenhum tipo tem dois plugins", () => {
    const tipos = PLUGINS_REGISTRADOS.map((p) => p.type);
    expect(new Set(tipos).size).toBe(tipos.length);
  });

  it("todo plugin tem um renderer registrado", () => {
    /*
     * Lido do código-fonte de propósito: importar `renderers/index.tsx` aqui
     * traria `next/dynamic` para um teste de ambiente Node. O que precisa ser
     * verificado é a existência da entrada, e ela é textual.
     */
    const fonte = readFileSync(
      join(process.cwd(), "src/activities/renderers/index.tsx"),
      "utf8",
    );

    for (const plugin of PLUGINS_REGISTRADOS) {
      expect(
        fonte.includes(`"${plugin.rendererId}"`),
        `O plugin ${plugin.type} declara rendererId "${plugin.rendererId}", que não está no mapa de renderers.`,
      ).toBe(true);
    }
  });

  it("o núcleo não menciona nenhum tipo concreto de atividade", () => {
    // A afirmação central da arquitetura, verificada no texto do núcleo.
    //
    // Só as declarações de import contam: comentários podem — e devem — citar
    // o manifesto para explicar onde os plugins entram.
    const importaPlugin = /^\s*import[\s\S]*?from\s+["'][^"']*plugins/m;

    for (const arquivo of ["registry.ts", "session.ts", "rewards.ts", "difficulty.ts"]) {
      const fonte = readFileSync(join(process.cwd(), "src/activities", arquivo), "utf8");
      const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

      expect(codigo.toLowerCase(), arquivo).not.toContain("multiple_choice");
      expect(codigo.toLowerCase(), arquivo).not.toContain("order_sequence");
      expect(importaPlugin.test(codigo), `${arquivo} importa um plugin concreto`).toBe(false);
    }
  });

  it("a apresentação declarada é de fato consumida pela tela", () => {
    /*
     * Regressão de um defeito real: a action calculava a apresentação e a
     * enviava ao cliente, e o executor ignorava. Animação, efeito e tempo de
     * leitura eram configuração morta trafegando na resposta.
     *
     * Configuração que ninguém lê é pior que configuração ausente: ela faz
     * quem autora acreditar que ajustou algo.
     */
    const runner = readFileSync(
      join(process.cwd(), "app/(play)/missao/[slug]/missao-runner.tsx"),
      "utf8",
    );

    expect(runner).toContain("FeedbackVisual");
    expect(runner).toContain("apresentacao.mostrarProgresso");
    expect(runner).toContain("apresentacao.mostrarPremio");
    expect(runner).toContain("segurarSegundos");
  });

  it("efeito de partícula desaparece com movimento reduzido", () => {
    // O efeito é enfeite por definição. Se algum dia carregar informação, esta
    // regra de CSS vira um defeito de acessibilidade — e o teste vira o alarme.
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const blocoReduzido = css.slice(css.indexOf("prefers-reduced-motion"));

    expect(blocoReduzido).toContain(".ca-efeito");
    expect(blocoReduzido).toContain("display: none");
  });

  it("telemetria não tem campo para id real de criança (docs/08 §12.7)", () => {
    const fonte = readFileSync(join(process.cwd(), "src/activities/telemetry.ts"), "utf8");

    // `pseudonymId` sim; `learnerId` como campo, jamais.
    expect(fonte).toContain("pseudonymId");
    expect(fonte).not.toMatch(/^\s*readonly learnerId/m);
  });
});
