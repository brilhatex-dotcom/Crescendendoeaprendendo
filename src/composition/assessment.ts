import { criarSubmeterTentativa, type SubmeterTentativa } from "@/modules/assessment";
import { criarRepositorioPrismaDeAvaliacao } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { criarCreditoDeRecompensa } from "@/modules/economy";
import { criarRepositorioPrismaDeCarteira } from "@/modules/economy/infrastructure/prisma-wallet-repository";
import { criarCreditoDeTentativa } from "@/modules/progression";
import { criarRepositorioPrismaDeProgresso } from "@/modules/progression/infrastructure/prisma-progress-repository";
import { db } from "@/server/db";
import { criarBarramento } from "@/server/event-bus";
import { criarDespachanteDoOutbox, type DespachanteDoOutbox } from "@/server/outbox";
import { criarTelemetriaDeTentativa } from "@/server/telemetry";
import { criarUnidadeDeTrabalho } from "@/server/unit-of-work";
import type { EventHandler } from "@/shared/kernel";
import { systemClock } from "@/shared/kernel";

/**
 * Composition root da jogada.
 *
 * **Este arquivo é o único lugar do sistema onde avaliação, progressão e
 * economia se encontram.** Nenhum dos três importa os outros: `assessment`
 * publica um evento, e a lista abaixo é quem decide quem escuta.
 *
 * É por isso que acrescentar um efeito — conquista ao dominar uma competência,
 * aviso ao responsável, sugestão de missão em família — é acrescentar uma linha
 * em `MANIPULADORES` e escrever o manipulador. Zero alteração em avaliação,
 * progressão ou economia (docs/01 §2).
 *
 * A ordem dentro do array importa pouco, mas não é aleatória: progressão antes
 * de economia porque a Luz é o que a criança olha primeiro, e num erro é o
 * primeiro registro que se quer ver no log.
 */

const repositorioDeProgresso = criarRepositorioPrismaDeProgresso(db);
const repositorioDeCarteira = criarRepositorioPrismaDeCarteira(db);

/**
 * Quem reage ao que acontece numa jogada.
 *
 * Cada manipulador declara o próprio modo. Os `inline` rodam dentro da
 * transação da tentativa — é o que faz a Luz aparecer no mesmo instante
 * (docs/08 §11). Os `outbox` rodam depois, pelo despachante.
 */
const MANIPULADORES: readonly EventHandler[] = [
  criarCreditoDeTentativa({ repositorio: repositorioDeProgresso, clock: systemClock }),
  criarCreditoDeRecompensa({ repositorio: repositorioDeCarteira }),
  criarTelemetriaDeTentativa(),
] as readonly EventHandler[];

interface ContainerDaJogada {
  readonly submeterTentativa: SubmeterTentativa;
  readonly progresso: typeof repositorioDeProgresso;
  readonly carteira: typeof repositorioDeCarteira;
  readonly despachante: DespachanteDoOutbox;
}

let cache: ContainerDaJogada | undefined;

export function containerDeAvaliacao(): ContainerDaJogada {
  cache ??= {
    submeterTentativa: criarSubmeterTentativa({
      repositorio: criarRepositorioPrismaDeAvaliacao(db),
      unidadeDeTrabalho: criarUnidadeDeTrabalho(db),
      barramento: criarBarramento(MANIPULADORES),
      clock: systemClock,
      dormir: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
    }),
    progresso: repositorioDeProgresso,
    carteira: repositorioDeCarteira,
    despachante: criarDespachanteDoOutbox(db, MANIPULADORES),
  };
  return cache;
}
