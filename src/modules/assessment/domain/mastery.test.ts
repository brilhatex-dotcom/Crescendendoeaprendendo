import { describe, expect, it } from "vitest";

import { BKT, atualizarProbabilidade, esquecer } from "./bkt";
import { ELO, atualizarHabilidade, fatorK, probabilidadeEsperada } from "./elo";
import { atingiuDominio, dominioInicial, evoluirDominio } from "./mastery";

/**
 * O modelo de domínio é a parte do sistema em que um erro é mais caro e menos
 * visível: ninguém percebe um BKT levemente errado olhando a tela. Percebe-se
 * meses depois, quando uma criança está travada num conteúdo que já dominava ou
 * foi promovida para outro que não sustenta.
 *
 * Por isso os testes aqui verificam **comportamento pedagógico**, não fórmulas.
 * "Chutar num teste de 4 opções convence menos que acertar uma resposta
 * construída" é uma frase que qualquer pessoa do time pode julgar; o Bayes que
 * a implementa, não.
 */

const REFERENCIA = 1000;

const evidencia = (parcial: Partial<Parameters<typeof evoluirDominio>[1]> = {}) => ({
  acertou: true,
  scoreRatio: 1,
  probabilidadeDeChute: 0.25,
  dificuldadeDaAtividade: REFERENCIA,
  dificuldadeDeReferencia: REFERENCIA,
  agora: new Date("2026-03-01T10:00:00Z"),
  ...parcial,
});

describe("BKT", () => {
  it("acertar aumenta a crença; errar diminui", () => {
    const acerto = atualizarProbabilidade({
      probabilidade: BKT.prior,
      scoreRatio: 1,
      chute: 0.25,
    });
    const erro = atualizarProbabilidade({
      probabilidade: BKT.prior,
      scoreRatio: 0,
      chute: 0.25,
    });

    expect(acerto).toBeGreaterThan(BKT.prior);
    expect(erro).toBeLessThan(acerto);
  });

  it("acerto vale mais onde é difícil chutar", () => {
    const multiplaEscolha = atualizarProbabilidade({
      probabilidade: BKT.prior,
      scoreRatio: 1,
      chute: 0.25, // quatro opções
    });
    const respostaConstruida = atualizarProbabilidade({
      probabilidade: BKT.prior,
      scoreRatio: 1,
      chute: 0.02,
    });

    // Esta é a razão de `P(guess)` vir do plugin e não ser fixo por tipo.
    expect(respostaConstruida).toBeGreaterThan(multiplaEscolha);
  });

  it("errar nunca zera a crença — ainda há a chance de ter escorregado", () => {
    let p: number = BKT.prior;
    for (let i = 0; i < 20; i += 1) {
      p = atualizarProbabilidade({ probabilidade: p, scoreRatio: 0, chute: 0.25 });
    }
    expect(p).toBeGreaterThan(0);
  });

  it("acerto parcial fica entre acertar e errar", () => {
    const meio = atualizarProbabilidade({ probabilidade: 0.5, scoreRatio: 0.5, chute: 0.25 });
    const tudo = atualizarProbabilidade({ probabilidade: 0.5, scoreRatio: 1, chute: 0.25 });
    const nada = atualizarProbabilidade({ probabilidade: 0.5, scoreRatio: 0, chute: 0.25 });

    expect(meio).toBeGreaterThan(nada);
    expect(meio).toBeLessThan(tudo);
  });

  it("mesmo errando, a chance de ter aprendido com o ensino é considerada", () => {
    // P(T) age depois do posterior: a criança leu a explicação.
    const semTransicao = 0.5 * BKT.escorregao / (0.5 * BKT.escorregao + 0.5 * 0.75);
    const comTransicao = atualizarProbabilidade({
      probabilidade: 0.5,
      scoreRatio: 0,
      chute: 0.25,
    });

    expect(comTransicao).toBeGreaterThan(semTransicao);
  });
});

describe("esquecimento", () => {
  it("cai com o tempo sem prática", () => {
    expect(esquecer(0.9, 30, false)).toBeLessThan(0.9);
  });

  it("nunca leva quem dominou abaixo do piso", () => {
    expect(esquecer(0.95, 3650, true)).toBe(BKT.pisoDoDominado);
  });

  it("não promove quem já estava abaixo do piso", () => {
    // O piso protege quem dominou; ele não é um empurrão para cima.
    expect(esquecer(0.05, 100, false)).toBeLessThanOrEqual(0.05);
  });

  it("sem tempo decorrido, não muda nada", () => {
    expect(esquecer(0.7, 0, false)).toBe(0.7);
  });
});

describe("Elo", () => {
  it("400 pontos de diferença valem 10 para 1", () => {
    expect(probabilidadeEsperada(1400, 1000)).toBeCloseTo(10 / 11, 3);
  });

  it("acertar o improvável move mais que acertar o esperado", () => {
    const dificil = atualizarHabilidade({
      habilidade: 1000,
      dificuldade: 1400,
      scoreRatio: 1,
      tentativasAnteriores: 0,
    });
    const facil = atualizarHabilidade({
      habilidade: 1000,
      dificuldade: 600,
      scoreRatio: 1,
      tentativasAnteriores: 0,
    });

    expect(dificil - 1000).toBeGreaterThan(facil - 1000);
  });

  it("K cai depois das primeiras tentativas", () => {
    expect(fatorK(0)).toBe(ELO.kInicial);
    expect(fatorK(ELO.tentativasAteEstabilizar)).toBe(ELO.kEstavel);
  });

  it("não escapa dos trilhos da escala nem com uma sequência longa", () => {
    let habilidade: number = ELO.centro;
    for (let i = 0; i < 500; i += 1) {
      habilidade = atualizarHabilidade({
        habilidade,
        dificuldade: 2400,
        scoreRatio: 1,
        tentativasAnteriores: i,
      });
    }
    expect(habilidade).toBeLessThanOrEqual(ELO.maxima);

    for (let i = 0; i < 500; i += 1) {
      habilidade = atualizarHabilidade({
        habilidade,
        dificuldade: 400,
        scoreRatio: 0,
        tentativasAnteriores: i,
      });
    }
    expect(habilidade).toBeGreaterThanOrEqual(ELO.minima);
  });
});

describe("domínio de competência", () => {
  it("começa no centro da escala e na crença inicial", () => {
    const inicial = dominioInicial();
    expect(inicial.habilidade).toBe(ELO.centro);
    expect(inicial.probabilidade).toBe(BKT.prior);
    expect(inicial.dominadaEm).toBeNull();
  });

  it("as três condições valem juntas — nenhuma sozinha declara domínio", () => {
    expect(atingiuDominio({ probabilidade: 0.99, tentativas: 2, sequencia: 5 })).toBe(false);
    expect(atingiuDominio({ probabilidade: 0.99, tentativas: 9, sequencia: 1 })).toBe(false);
    expect(atingiuDominio({ probabilidade: 0.5, tentativas: 9, sequencia: 5 })).toBe(false);
    expect(atingiuDominio({ probabilidade: 0.9, tentativas: 3, sequencia: 2 })).toBe(true);
  });

  it("acertar só o fácil não constrói sequência — e por isso não vira domínio", () => {
    let estado = dominioInicial();

    for (let i = 0; i < 10; i += 1) {
      estado = evoluirDominio(
        estado,
        evidencia({
          probabilidadeDeChute: 0.02,
          dificuldadeDaAtividade: 700, // abaixo da referência
          agora: new Date(Date.UTC(2026, 2, 1 + i)),
        }),
      );
    }

    // A crença sobe — dez acertos são dez acertos —, mas a prova de domínio
    // exige acerto no nível de referência. Sem isso, o sistema promoveria a
    // criança com base em conteúdo que ela já dominava.
    expect(estado.probabilidade).toBeGreaterThan(BKT.limiarDeDominio);
    expect(estado.sequencia).toBe(0);
    expect(estado.dominadaEm).toBeNull();
  });

  it("acertar no nível de referência três vezes declara domínio", () => {
    let estado = dominioInicial();

    for (let i = 0; i < 3; i += 1) {
      estado = evoluirDominio(
        estado,
        evidencia({
          probabilidadeDeChute: 0.02,
          agora: new Date(Date.UTC(2026, 2, 1 + i)),
        }),
      );
    }

    expect(estado.sequencia).toBe(3);
    expect(estado.dominadaEm).not.toBeNull();
  });

  it("errar zera a sequência", () => {
    const comSequencia = { ...dominioInicial(), sequencia: 4 };
    const depois = evoluirDominio(comSequencia, evidencia({ acertou: false, scoreRatio: 0 }));
    expect(depois.sequencia).toBe(0);
  });

  it("acerto parcial move o modelo mas não conta como acerto consecutivo", () => {
    const comSequencia = { ...dominioInicial(), sequencia: 1 };
    const depois = evoluirDominio(
      comSequencia,
      evidencia({ acertou: false, scoreRatio: 0.75 }),
    );

    expect(depois.probabilidade).toBeGreaterThan(comSequencia.probabilidade);
    expect(depois.sequencia).toBe(0);
    expect(depois.acertos).toBe(0);
  });

  it("domínio alcançado nunca é retirado, mesmo com erro depois", () => {
    let estado = dominioInicial();
    for (let i = 0; i < 3; i += 1) {
      estado = evoluirDominio(
        estado,
        evidencia({ probabilidadeDeChute: 0.02, agora: new Date(Date.UTC(2026, 2, 1 + i)) }),
      );
    }
    const dominadaEm = estado.dominadaEm;
    expect(dominadaEm).not.toBeNull();

    for (let i = 0; i < 10; i += 1) {
      estado = evoluirDominio(
        estado,
        evidencia({
          acertou: false,
          scoreRatio: 0,
          agora: new Date(Date.UTC(2026, 3, 1 + i)),
        }),
      );
    }

    // A probabilidade despenca — e é ela que recoloca a competência na fila de
    // revisão. O marco, não: regressão é proibida (docs/08 §1).
    expect(estado.probabilidade).toBeLessThan(BKT.limiarDeDominio);
    expect(estado.dominadaEm).toEqual(dominadaEm);
  });

  it("a versão avança a cada evidência — é o que sustenta a escrita condicional", () => {
    const depois = evoluirDominio(dominioInicial(), evidencia());
    expect(depois.versao).toBe(1);
    expect(evoluirDominio(depois, evidencia()).versao).toBe(2);
  });

  it("esquece antes de aprender: o tempo parado já passou quando a criança responde", () => {
    const antigo = {
      ...dominioInicial(),
      probabilidade: 0.9,
      dominadaEm: new Date("2026-01-01T00:00:00Z"),
      ultimaTentativaEm: new Date("2026-01-01T00:00:00Z"),
    };

    const semPausa = evoluirDominio(
      { ...antigo, ultimaTentativaEm: new Date("2026-02-28T10:00:00Z") },
      evidencia(),
    );
    const comPausa = evoluirDominio(antigo, evidencia());

    expect(comPausa.probabilidade).toBeLessThan(semPausa.probabilidade);
  });
});
