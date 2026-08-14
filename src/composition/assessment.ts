import { seletorPorProximidade } from "@/activities";
import { criarAvaliacaoPorMissao, criarAvaliacaoPorTentativa } from "@/modules/achievement";
import { criarRepositorioPrismaDeConquistas } from "@/modules/achievement/infrastructure/prisma-achievement-repository";
import { criarSubmeterTentativa, type SubmeterTentativa } from "@/modules/assessment";
import { criarRepositorioPrismaDeAvaliacao } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { criarConcessaoPorMissao, criarConcessaoPorTentativa } from "@/modules/collection";
import { criarRepositorioPrismaDeColecionaveis } from "@/modules/collection/infrastructure/prisma-collection-repository";
import {
  criarCreditoDeMissao as criarCreditoDeMissaoNaCarteira,
  criarCreditoDeRecompensa,
} from "@/modules/economy";
import { criarRepositorioPrismaDeCarteira } from "@/modules/economy/infrastructure/prisma-wallet-repository";
import {
  criarCobrancaDeFolego,
  criarCreditoDeMissao as criarCreditoDeMissaoNaLuz,
  criarCreditoDeTentativa,
} from "@/modules/progression";
import { criarRepositorioPrismaDeProgresso } from "@/modules/progression/infrastructure/prisma-progress-repository";
import {
  criarAbrirJogada,
  criarAvancoDaCorrida,
  criarConcluirJogada,
  criarMontarMapa,
  type AbrirJogada,
  type ConcluirJogada,
  type MontarMapa,
} from "@/modules/quest";
import { criarLeituraPrismaDoMapa } from "@/modules/quest/infrastructure/prisma-map-reader";
import { criarRepositorioPrismaDeMissoes } from "@/modules/quest/infrastructure/prisma-quest-repository";
import { criarRepositorioPrismaDeSlots } from "@/modules/quest/infrastructure/prisma-slot-repository";
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
 * **Este arquivo é o único lugar do sistema onde avaliação, missão, progressão
 * e economia se encontram.** Nenhum dos quatro importa os outros: quem publica
 * um evento não sabe quem escuta, e a tabela abaixo é a resposta inteira.
 *
 * | evento                       | quem reage                                  |
 * |------------------------------|---------------------------------------------|
 * | `quest.started`              | progressão cobra o Fôlego                    |
 * | `assessment.attempt_evaluated` | progressão credita Luz · economia credita Fagulha · missão avança a corrida · coleção concede figurinha · conquista avança progresso (pelo outbox) |
 * | `quest.completed`            | progressão credita a recompensa e avança a Trilha · economia credita a moeda · coleção concede figurinha · conquista avança progresso (pelo outbox) |
 * | `learning.attempt_recorded`  | telemetria (pelo outbox)                     |
 *
 * Acrescentar um efeito — aviso ao responsável, sugestão de missão em
 * família — é acrescentar uma linha em `MANIPULADORES`. Zero alteração nos
 * módulos (docs/01 §2).
 */

const repositorioDeProgresso = criarRepositorioPrismaDeProgresso(db);
const repositorioDeCarteira = criarRepositorioPrismaDeCarteira(db);
const repositorioDeColecionaveis = criarRepositorioPrismaDeColecionaveis(db);
const repositorioDeConquistas = criarRepositorioPrismaDeConquistas(db);
const repositorioDeMissoes = criarRepositorioPrismaDeMissoes();
const repositorioDeSlots = criarRepositorioPrismaDeSlots();
const leituraDoMapa = criarLeituraPrismaDoMapa(db);

const unidadeDeTrabalho = criarUnidadeDeTrabalho(db);

/**
 * Quem reage ao que acontece numa jogada.
 *
 * Cada manipulador declara o próprio modo. Os `inline` rodam dentro da
 * transação que os originou — é o que faz a Luz aparecer no mesmo instante
 * (docs/08 §11). Os `outbox` rodam depois, pelo despachante.
 */
const MANIPULADORES: readonly EventHandler[] = [
  // quest.started
  criarCobrancaDeFolego({ repositorio: repositorioDeProgresso, clock: systemClock }),

  // assessment.attempt_evaluated
  criarCreditoDeTentativa({ repositorio: repositorioDeProgresso, clock: systemClock }),
  criarCreditoDeRecompensa({ repositorio: repositorioDeCarteira }),
  criarConcessaoPorTentativa({ repositorio: repositorioDeColecionaveis }),
  criarAvaliacaoPorTentativa({ repositorio: repositorioDeConquistas, clock: systemClock }),
  criarAvancoDaCorrida({
    repositorio: repositorioDeMissoes,
    slots: repositorioDeSlots,
    seletor: seletorPorProximidade,
    clock: systemClock,
  }),

  // quest.completed
  criarCreditoDeMissaoNaLuz({ repositorio: repositorioDeProgresso, clock: systemClock }),
  criarCreditoDeMissaoNaCarteira({ repositorio: repositorioDeCarteira }),
  criarConcessaoPorMissao({ repositorio: repositorioDeColecionaveis }),
  criarAvaliacaoPorMissao({ repositorio: repositorioDeConquistas, clock: systemClock }),

  // learning.attempt_recorded
  criarTelemetriaDeTentativa(),
] as readonly EventHandler[];

const barramento = criarBarramento(MANIPULADORES);

const depsDeMissao = {
  repositorio: repositorioDeMissoes,
  leitura: leituraDoMapa,
  slots: repositorioDeSlots,
  seletor: seletorPorProximidade,
  unidadeDeTrabalho,
  barramento,
  clock: systemClock,
};

interface ContainerDaJogada {
  readonly submeterTentativa: SubmeterTentativa;
  readonly abrirJogada: AbrirJogada;
  readonly concluirJogada: ConcluirJogada;
  readonly montarMapa: MontarMapa;
  readonly progresso: typeof repositorioDeProgresso;
  readonly carteira: typeof repositorioDeCarteira;
  readonly colecao: typeof repositorioDeColecionaveis;
  readonly conquistas: typeof repositorioDeConquistas;
  readonly despachante: DespachanteDoOutbox;
}

let cache: ContainerDaJogada | undefined;

export function containerDeAvaliacao(): ContainerDaJogada {
  cache ??= {
    submeterTentativa: criarSubmeterTentativa({
      repositorio: criarRepositorioPrismaDeAvaliacao(db),
      unidadeDeTrabalho,
      barramento,
      clock: systemClock,
      dormir: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
    }),
    abrirJogada: criarAbrirJogada(depsDeMissao),
    concluirJogada: criarConcluirJogada(depsDeMissao),
    montarMapa: criarMontarMapa({ leitura: leituraDoMapa }),
    progresso: repositorioDeProgresso,
    carteira: repositorioDeCarteira,
    colecao: repositorioDeColecionaveis,
    conquistas: repositorioDeConquistas,
    despachante: criarDespachanteDoOutbox(db, MANIPULADORES),
  };
  return cache;
}
