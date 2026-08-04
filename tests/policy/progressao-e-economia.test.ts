import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { carteiraInicial, lancar } from "@/modules/economy";
import { aplicarGanho, progressoInicial, registrarDia } from "@/modules/progression";

/**
 * REGRAS CONSTITUCIONAIS DA PROGRESSÃO E DA ECONOMIA (docs/08 §12).
 *
 * Estas são as promessas mais fáceis de trair sem má intenção — bastam uma
 * pressa e uma boa ideia. Cada teste aqui é uma delas, e quebrá-la quebra o
 * build.
 */

const AGORA = new Date("2026-03-01T10:00:00Z");

const ler = (caminho: string): string => readFileSync(join(process.cwd(), caminho), "utf8");

describe("§1 — nunca há perda de Luz nem rebaixamento", () => {
  it("Luz nunca diminui", () => {
    const inicial = { ...progressoInicial(AGORA), luzTotal: 800 };
    const depois = aplicarGanho(inicial, { luz: -500, folego: 0, agora: AGORA, dia: "2026-03-01" });

    expect(depois.proximo.luzTotal).toBeGreaterThanOrEqual(inicial.luzTotal);
  });

  it("o nível nunca desce", () => {
    let estado = progressoInicial(AGORA);
    let maiorNivel = estado.nivel;

    for (let i = 0; i < 200; i += 1) {
      estado = aplicarGanho(estado, {
        luz: i % 3 === 0 ? 0 : 12,
        folego: 0,
        agora: AGORA,
        dia: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
      }).proximo;

      expect(estado.nivel).toBeGreaterThanOrEqual(maiorNivel);
      maiorNivel = estado.nivel;
    }
  });

  it("o recorde da Trilha de Luz nunca é apagado", () => {
    let trilha = { dias: 0, recorde: 0, lanternas: 0, ultimoDia: null as string | null };

    for (let dia = 1; dia <= 12; dia += 1) {
      trilha = registrarDia(trilha, `2026-03-${String(dia).padStart(2, "0")}`);
    }
    const recorde = trilha.recorde;

    // Sumiu por um mês.
    trilha = registrarDia(trilha, "2026-04-30");

    expect(trilha.dias).toBe(1);
    expect(trilha.recorde).toBe(recorde);
  });
});

describe("§4 — o Fôlego nunca é pedágio para aprender", () => {
  it("responder não tem caminho que gaste Fôlego", () => {
    const fonte = ler("src/modules/progression/domain/energy.ts");

    // A ausência é a garantia: só existe `devolver`. Se um dia alguém
    // acrescentar `gastar` aqui, é neste teste que a conversa começa — o gasto
    // pertence a quem inicia uma missão, nunca a quem responde.
    expect(fonte).toContain("export const devolver");
    expect(fonte).not.toMatch(/export (function|const) gastar/);
  });

  it("uma tentativa nunca reduz o Fôlego, mesmo errando", () => {
    const cansada = { ...progressoInicial(AGORA), folego: 1 };
    const depois = aplicarGanho(cansada, {
      luz: 0,
      folego: 0,
      agora: AGORA,
      dia: "2026-03-01",
    });

    expect(depois.proximo.folego).toBeGreaterThanOrEqual(cansada.folego);
  });
});

describe("§5 — invariantes da economia", () => {
  it("o saldo nunca fica negativo", () => {
    const carteira = { ...carteiraInicial(), fagulhas: 3 };
    const resultado = lancar(carteira, [
      {
        moeda: "COIN",
        quantidade: -4,
        motivo: "SHOP_PURCHASE",
        refType: null,
        refId: null,
        idempotencyKey: "k",
      },
    ]);

    expect(resultado.recusado).not.toBeNull();
    expect(resultado.carteira.fagulhas).toBe(3);
  });

  it("todo lançamento carrega chave de idempotência", () => {
    const resultado = lancar(carteiraInicial(), [
      {
        moeda: "COIN",
        quantidade: 7,
        motivo: "ACTIVITY_REWARD",
        refType: "Attempt",
        refId: "a",
        idempotencyKey: "chave-x",
      },
    ]);

    for (const lancamento of resultado.lancamentos) {
      expect(lancamento.idempotencyKey.length).toBeGreaterThan(0);
    }
  });

  it("nenhuma moeda se compra com dinheiro real", () => {
    /*
     * Bíblia Cap. 6 §6.5. A garantia é estrutural: não existe no módulo
     * nenhuma referência a preço em dinheiro, cobrança ou pagamento. Este teste
     * é o alarme para o dia em que alguém achar que "só uma promoçãozinha".
     */
    for (const arquivo of [
      "src/modules/economy/domain/ledger.ts",
      "src/modules/economy/application/credit-reward.ts",
    ]) {
      const fonte = ler(arquivo).toLowerCase();
      for (const proibido of ["stripe", "checkout", "payment", "pagamento", "brl", "centavos"]) {
        expect(fonte).not.toContain(proibido);
      }
    }
  });
});

describe("§11 — o que é atômico continua atômico", () => {
  it("progressão e economia reagem dentro da transação, não pelo outbox", () => {
    const progressao = ler("src/modules/progression/application/credit-attempt.ts");
    const economia = ler("src/modules/economy/application/credit-reward.ts");

    // `outbox` aqui significaria a criança terminar a atividade e não ver Luz
    // nenhuma subir até o despachante rodar.
    expect(progressao).toContain('modo: "inline"');
    expect(economia).toContain('modo: "inline"');
  });

  it("a telemetria reage pelo outbox, não dentro da transação", () => {
    const telemetria = ler("src/server/telemetry.ts");

    // Medir não pode derrubar a jogada da criança.
    expect(telemetria).toContain('modo: "outbox"');
  });

  it("nenhum módulo chama outro — todos se encontram no composition root", () => {
    const avaliacao = ler("src/modules/assessment/application/submit-attempt.ts");

    expect(avaliacao).not.toContain("@/modules/progression");
    expect(avaliacao).not.toContain("@/modules/economy");
  });
});

describe("§12 — a rota de despacho é fail-closed", () => {
  it("sem CRON_SECRET, ninguém despacha", () => {
    const fonte = ler("app/api/outbox/route.ts");

    // O oposto — rota aberta quando o segredo falta — deixaria qualquer um na
    // internet disparar o processamento da fila.
    expect(fonte).toMatch(/if \(!segredo\)/);
    expect(fonte).toContain("503");
    expect(fonte).toContain("401");
  });
});
