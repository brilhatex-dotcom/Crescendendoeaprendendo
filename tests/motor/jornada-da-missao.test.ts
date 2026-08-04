import { describe, expect, it } from "vitest";

import {
  atividadeEm,
  avaliarAtividade,
  indiceAbsoluto,
  premioDaAtividade,
  primeiraPosicao,
  proximaPosicao,
  registroPadrao,
  resolverApresentacao,
  totalDeAtividades,
  type EvaluationContext,
  type PosicaoNaMissao,
} from "@/activities";
import { carregarMissaoParaSessao, listarMissoes } from "@/activities/content-bridge";
import { unwrap } from "@/shared/kernel";

/**
 * JORNADA COMPLETA — do arquivo JSON à devolutiva.
 *
 * Este teste percorre exatamente o caminho que uma criança percorre, mas sem
 * navegador: carrega a missão do acervo em disco, avança fase a fase, responde,
 * recebe devolutiva e prêmio. É a prova de que "conteúdo é dado" não é slogan —
 * nenhuma linha deste teste sabe o que é múltipla escolha ou ordenação.
 *
 * Não precisa de banco: o motor não depende de banco.
 */

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 6000,
  locale: "pt-BR",
};

const SLUG = "missao-01-a-contagem-da-orla";

/**
 * Resposta correta extraída da própria config, sem conhecer o tipo por dentro.
 * O teste "joga" olhando o gabarito, que é o que um autor faria ao conferir.
 */
function respostaCorreta(tipo: string, config: unknown): unknown {
  if (tipo === "MULTIPLE_CHOICE") {
    const c = config as { opcoes: { id: string; correta: boolean }[] };
    return { opcaoId: c.opcoes.find((o) => o.correta)?.id ?? null };
  }
  if (tipo === "ORDER_SEQUENCE") {
    const c = config as { ordemCorreta: string[] };
    return { ordem: [...c.ordemCorreta] };
  }
  throw new Error(`Teste não sabe responder ao tipo ${tipo}. Adicione o gabarito aqui.`);
}

describe("o acervo alimenta o motor", () => {
  it("lista a missão de demonstração", async () => {
    const missoes = await listarMissoes();
    expect(missoes.map((m) => m.slug)).toContain(SLUG);
  });

  it("carrega a missão com fases e atividades", async () => {
    const missao = await carregarMissaoParaSessao(SLUG);
    expect(missao).not.toBeNull();
    expect(missao?.fases.length).toBeGreaterThanOrEqual(2);
    expect(totalDeAtividades(missao!)).toBe(3);
  });

  it("devolve null para missão inexistente, sem explodir", async () => {
    expect(await carregarMissaoParaSessao("missao-que-nao-existe")).toBeNull();
  });
});

describe("jogada completa, do começo ao fim", () => {
  it("atravessa as fases respondendo certo e acumula prêmio", async () => {
    const missao = await carregarMissaoParaSessao(SLUG);
    if (!missao) throw new Error("missão não carregada");

    let posicao: PosicaoNaMissao | null = primeiraPosicao();
    let xpTotal = 0;
    const visitadas: string[] = [];

    while (posicao) {
      const atividade = atividadeEm(missao, posicao);
      if (!atividade) break;

      visitadas.push(atividade.slug);

      const resultado = unwrap(
        avaliarAtividade(
          registroPadrao,
          { type: atividade.tipo, config: atividade.config },
          respostaCorreta(atividade.tipo, atividade.config),
          CTX,
        ),
      );

      expect(resultado.outcome, atividade.slug).toBe("CORRECT");
      expect(resultado.feedback?.tom).toBe("CELEBRA");

      const premio = premioDaAtividade(atividade, resultado, {
        dicasUsadas: 0,
        repeticoes: 0,
        habilidadeDaCrianca: 1000,
        semFolego: false,
      });
      xpTotal += premio?.xp ?? 0;

      posicao = proximaPosicao(missao, posicao);
    }

    // As três atividades, atravessando a fronteira entre as duas fases.
    expect(visitadas).toEqual([
      "contar-conchas-4",
      "comparar-conchas-e-pedras",
      "ordenar-4-numeros",
    ]);
    expect(xpTotal).toBeGreaterThan(0);
  });

  it("a barra de progresso avança de 1 até o total", async () => {
    const missao = await carregarMissaoParaSessao(SLUG);
    if (!missao) throw new Error("missão não carregada");

    const indices: number[] = [];
    let posicao: PosicaoNaMissao | null = primeiraPosicao();

    while (posicao) {
      indices.push(indiceAbsoluto(missao, posicao) + 1);
      posicao = proximaPosicao(missao, posicao);
    }

    expect(indices).toEqual([1, 2, 3]);
  });
});

describe("errar no meio da missão", () => {
  it("recebe ensino específico e continua podendo avançar", async () => {
    const missao = await carregarMissaoParaSessao(SLUG);
    if (!missao) throw new Error("missão não carregada");

    const atividade = atividadeEm(missao, primeiraPosicao());
    if (!atividade) throw new Error("atividade não encontrada");

    const config = atividade.config as {
      opcoes: { id: string; correta: boolean; ensino?: string }[];
    };
    const errada = config.opcoes.find((o) => !o.correta);

    const resultado = unwrap(
      avaliarAtividade(
        registroPadrao,
        { type: atividade.tipo, config: atividade.config },
        { opcaoId: errada?.id },
        CTX,
      ),
    );

    expect(resultado.outcome).toBe("INCORRECT");
    if (resultado.outcome === "CORRECT" || resultado.outcome === "SKIPPED") return;

    /*
     * O ensino é exatamente o texto escrito no arquivo para AQUELA opção — não
     * uma frase genérica do motor. É esta igualdade que prova que a devolutiva
     * pedagógica é conteúdo, e não código.
     */
    expect(resultado.feedback.ensino).toBe(errada?.ensino);
    expect(resultado.equivoco).toBeTruthy();

    // Errar rende XP: nunca zero (docs/08 §1).
    const premio = premioDaAtividade(atividade, resultado, {
      dicasUsadas: 0,
      repeticoes: 0,
      habilidadeDaCrianca: 1000,
      semFolego: false,
    });
    expect(premio?.xp).toBeGreaterThan(0);
  });

  it("a apresentação da devolutiva muda com o tom", async () => {
    const celebra = resolverApresentacao("CELEBRA", undefined);
    const orienta = resolverApresentacao("ORIENTA", undefined);

    expect(celebra.efeito).toBe("FAISCAS");
    // Erro não ganha efeito de partícula nem som de alarme.
    expect(orienta.efeito).toBe("NENHUM");
    // E segura na tela, porque é o que mais tem o que ensinar.
    expect(orienta.segurarSegundos).toBeGreaterThan(0);
  });
});
