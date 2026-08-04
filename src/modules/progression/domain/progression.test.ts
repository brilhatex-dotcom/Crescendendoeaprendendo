import { describe, expect, it } from "vitest";

import { FOLEGO, devolver, regenerar } from "./energy";
import { luzAcumuladaParaNivel, nivelParaLuz, progressoNoNivel, tierDoNivel } from "./level";
import { aplicarGanho, comoEstaAgora, progressoInicial } from "./progress";
import { TRILHA, diaCivil, registrarDia, type EstadoDaTrilha } from "./streak";

/**
 * Progressão é onde as promessas do produto viram aritmética. Os testes daqui
 * verificam **as promessas**, não as fórmulas: "nunca perde Luz", "Fôlego
 * zerado não impede aprender", "o recorde é preservado". Se alguém trocar a
 * curva de nível por outra melhor, estes testes continuam valendo; se alguém
 * fizer a criança regredir, quebram.
 */

const AGORA = new Date("2026-03-01T10:00:00Z");

describe("nível e tier", () => {
  it("o nível 1 começa em zero de Luz", () => {
    expect(luzAcumuladaParaNivel(1)).toBe(0);
    expect(nivelParaLuz(0)).toBe(1);
  });

  it("a curva sobe rápido no começo e desacelera", () => {
    const primeiroSalto = luzAcumuladaParaNivel(3) - luzAcumuladaParaNivel(2);
    const saltoTardio = luzAcumuladaParaNivel(31) - luzAcumuladaParaNivel(30);

    expect(saltoTardio).toBeGreaterThan(primeiroSalto);
  });

  it("mais Luz nunca dá um nível menor", () => {
    let anterior = 1;
    for (let luz = 0; luz < 60_000; luz += 250) {
      const nivel = nivelParaLuz(luz);
      expect(nivel).toBeGreaterThanOrEqual(anterior);
      anterior = nivel;
    }
  });

  it("os tiers seguem a tabela de docs/08 §1", () => {
    expect(tierDoNivel(1)).toBe("APRENDIZ");
    expect(tierDoNivel(9)).toBe("APRENDIZ");
    expect(tierDoNivel(10)).toBe("EXPLORADOR");
    expect(tierDoNivel(34)).toBe("INVENTOR");
    expect(tierDoNivel(50)).toBe("MESTRE");
    expect(tierDoNivel(120)).toBe("LENDA");
    expect(tierDoNivel(999)).toBe("LENDA");
  });

  it("o progresso no nível nunca passa do que falta para subir", () => {
    for (const luz of [0, 50, 119, 120, 500, 5000]) {
      const { luzNoNivel, luzParaSubir } = progressoNoNivel(luz);
      expect(luzNoNivel).toBeGreaterThanOrEqual(0);
      expect(luzNoNivel).toBeLessThan(luzParaSubir);
    }
  });
});

describe("Fôlego", () => {
  it("regenera 1 a cada 6 minutos", () => {
    const meiaHora = new Date(AGORA.getTime() + 30 * 60_000);
    expect(regenerar(50, AGORA, meiaHora).folego).toBe(55);
  });

  it("não passa do máximo", () => {
    const umDia = new Date(AGORA.getTime() + 24 * 60 * 60_000);
    expect(regenerar(90, AGORA, umDia).folego).toBe(FOLEGO.maximo);
  });

  it("a fração de minuto não é jogada fora", () => {
    /*
     * Cinco minutos não completam um ponto. Se o relógio avançasse assim mesmo,
     * quem abrisse o app a cada cinco minutos nunca regeneraria nada — o tempo
     * seria descartado a cada leitura.
     */
    const cincoMinutos = new Date(AGORA.getTime() + 5 * 60_000);
    const primeira = regenerar(50, AGORA, cincoMinutos);
    expect(primeira.folego).toBe(50);
    expect(primeira.atualizadoEm).toEqual(AGORA);

    const seteMinutos = new Date(AGORA.getTime() + 7 * 60_000);
    expect(regenerar(50, primeira.atualizadoEm, seteMinutos).folego).toBe(51);
  });

  it("devolver respeita o teto e ignora valor negativo", () => {
    expect(devolver(95, 20)).toBe(FOLEGO.maximo);
    expect(devolver(50, -10)).toBe(50);
  });
});

describe("Trilha de Luz", () => {
  const vazia: EstadoDaTrilha = { dias: 0, recorde: 0, lanternas: 1, ultimoDia: null };

  it("o primeiro dia começa a sequência em 1", () => {
    expect(registrarDia(vazia, "2026-03-01").dias).toBe(1);
  });

  it("jogar duas vezes no mesmo dia não conta duas", () => {
    const um = registrarDia(vazia, "2026-03-01");
    expect(registrarDia(um, "2026-03-01")).toBe(um);
  });

  it("dias seguidos somam", () => {
    let trilha = registrarDia(vazia, "2026-03-01");
    trilha = registrarDia(trilha, "2026-03-02");
    trilha = registrarDia(trilha, "2026-03-03");
    expect(trilha.dias).toBe(3);
  });

  it("uma lanterna cobre o dia que faltou", () => {
    const comLanterna: EstadoDaTrilha = {
      dias: 8,
      recorde: 8,
      lanternas: 1,
      ultimoDia: "2026-03-01",
    };

    // Pulou o dia 2, voltou no dia 3.
    const depois = registrarDia(comLanterna, "2026-03-03");

    expect(depois.dias).toBe(9);
    expect(depois.lanternas).toBe(0);
  });

  it("sem lanterna a sequência recomeça em 1 — nunca em zero", () => {
    const semLanterna: EstadoDaTrilha = {
      dias: 12,
      recorde: 12,
      lanternas: 0,
      ultimoDia: "2026-03-01",
    };

    const depois = registrarDia(semLanterna, "2026-03-05");

    // 1, e não 0: ela jogou hoje. Zero diria que não.
    expect(depois.dias).toBe(1);
  });

  it("o recorde é preservado quando a sequência cai", () => {
    const longa: EstadoDaTrilha = {
      dias: 40,
      recorde: 40,
      lanternas: 0,
      ultimoDia: "2026-03-01",
    };

    const depois = registrarDia(longa, "2026-03-10");

    // O número que representa meses de esforço não some. Perdê-lo de vez é o
    // que faz alguém desistir de vez (docs/08 §6).
    expect(depois.recorde).toBe(40);
    expect(depois.dias).toBe(1);
  });

  it("ganha uma lanterna a cada 5 dias, até o teto", () => {
    let trilha = vazia;
    for (let dia = 1; dia <= 20; dia += 1) {
      trilha = registrarDia(trilha, `2026-03-${String(dia).padStart(2, "0")}`);
    }
    expect(trilha.dias).toBe(20);
    expect(trilha.lanternas).toBe(TRILHA.maximoDeLanternas);
  });

  it("o dia civil respeita o fuso de quem joga", () => {
    // 01:00 UTC de 2 de março ainda é 1º de março em São Paulo. Contar em UTC
    // faria quem joga à noite ganhar um dia que não jogou — e perder a
    // sequência no dia seguinte.
    const madrugada = new Date("2026-03-02T01:00:00Z");
    expect(diaCivil(madrugada, "America/Sao_Paulo")).toBe("2026-03-01");
    expect(diaCivil(madrugada, "UTC")).toBe("2026-03-02");
  });
});

describe("aplicar o ganho de uma tentativa", () => {
  const inicial = progressoInicial(AGORA);

  it("credita a Luz e recalcula nível e tier", () => {
    const depois = aplicarGanho(inicial, {
      luz: 130,
      folego: 0,
      agora: AGORA,
      dia: "2026-03-01",
    });

    expect(depois.proximo.luzTotal).toBe(130);
    expect(depois.proximo.nivel).toBe(2);
    expect(depois.subiuDeNivel).toBe(true);
  });

  it("Luz nunca diminui, mesmo com ganho negativo vindo de dado corrompido", () => {
    const comLuz = { ...inicial, luzTotal: 500, nivel: nivelParaLuz(500) };
    const depois = aplicarGanho(comLuz, {
      luz: -100,
      folego: 0,
      agora: AGORA,
      dia: "2026-03-01",
    });

    expect(depois.proximo.luzTotal).toBe(500);
    expect(depois.proximo.nivel).toBe(comLuz.nivel);
    expect(depois.subiuDeNivel).toBe(false);
  });

  it("o nível é sempre recalculado da Luz — coluna divergente se corrige sozinha", () => {
    // A Luz é a única fonte da verdade. Se `level` ficar errado no banco (por
    // migração, correção manual, defeito antigo), a próxima tentativa o
    // conserta em vez de perpetuar o erro.
    const divergente = { ...inicial, luzTotal: 500, nivel: 1 };
    const depois = aplicarGanho(divergente, {
      luz: 0,
      folego: 0,
      agora: AGORA,
      dia: "2026-03-01",
    });

    expect(depois.proximo.nivel).toBe(nivelParaLuz(500));
  });

  it("responder nunca gasta Fôlego", () => {
    const cansada = { ...inicial, folego: 3 };
    const depois = aplicarGanho(cansada, {
      luz: 10,
      folego: 0,
      agora: AGORA,
      dia: "2026-03-01",
    });

    expect(depois.proximo.folego).toBeGreaterThanOrEqual(3);
  });

  it("regenera o Fôlego antes de creditar o que o prêmio devolve", () => {
    const antiga = {
      ...inicial,
      folego: 40,
      folegoAtualizadoEm: new Date(AGORA.getTime() - 60 * 60_000), // 1h atrás
    };

    const depois = aplicarGanho(antiga, {
      luz: 0,
      folego: 5,
      agora: AGORA,
      dia: "2026-03-01",
    });

    // 40 + 10 regenerados + 5 do prêmio. Creditar antes de regenerar
    // descartaria a hora esperada e o prêmio viraria punição.
    expect(depois.proximo.folego).toBe(55);
  });

  it("a Trilha de Luz avança mesmo sem prêmio nenhum", () => {
    const depois = aplicarGanho(inicial, {
      luz: 0,
      folego: 0,
      agora: AGORA,
      dia: "2026-03-01",
    });

    // A sequência mede presença, não pontuação.
    expect(depois.proximo.trilha.dias).toBe(1);
    expect(depois.diaNovoNaTrilha).toBe(true);
  });

  it("a versão avança a cada ganho — é o que sustenta a escrita condicional", () => {
    const depois = aplicarGanho(inicial, {
      luz: 5,
      folego: 0,
      agora: AGORA,
      dia: "2026-03-01",
    });
    expect(depois.proximo.versao).toBe(inicial.versao + 1);
  });

  it("a leitura mostra o Fôlego de agora, não o da última gravação", () => {
    const antiga = {
      ...inicial,
      folego: 20,
      folegoAtualizadoEm: new Date(AGORA.getTime() - 3 * 60 * 60_000),
    };

    expect(comoEstaAgora(antiga, AGORA).folego).toBe(50);
  });
});
