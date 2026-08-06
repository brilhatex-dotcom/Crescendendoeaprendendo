import type { SeletorDeAtividades } from "@/activities";
import { ConflitoDeConcorrencia } from "@/shared/kernel";
import type { Clock, EventBus, Transacao, UnidadeDeTrabalho } from "@/shared/kernel";

import type { DadosDaMissao, EstadoDaCorrida } from "../domain/quest-run";
import type { EstadoParaDesbloqueio, RegraDeDesbloqueio } from "../domain/unlock-rule";

/**
 * Duas jogadas da mesma missão começaram ao mesmo tempo.
 *
 * Acontece com dois toques no botão "Começar" — e a defesa importa porque cada
 * corrida cobra Fôlego. Sem ela, o toque duplo custaria dobrado.
 */
export class CorridaJaAberta extends ConflitoDeConcorrencia {
  constructor() {
    super("QuestRun");
    this.name = "CorridaJaAberta";
  }
}

export interface RepositorioDeMissoes {
  /** Missão pela referência de origem em `content/`. `null` se não importada. */
  buscarMissao(refDaMissao: string, tx: Transacao): Promise<DadosDaMissao | null>;

  /**
   * Missão pelo id.
   *
   * Existe porque quem reage a uma tentativa conhece a corrida, não o arquivo
   * de origem — e fazer o manipulador carregar o acervo do disco para descobrir
   * a referência seria acoplá-lo a `content/` sem nenhum ganho.
   */
  buscarMissaoPorQuestId(questId: string, tx: Transacao): Promise<DadosDaMissao | null>;

  /** Jogada em andamento desta criança nesta missão, se houver. */
  corridaEmAndamento(
    learnerId: string,
    questId: string,
    tx: Transacao,
  ): Promise<EstadoDaCorrida | null>;

  corridaPorId(questRunId: string, tx: Transacao): Promise<EstadoDaCorrida | null>;

  /** Abre uma jogada. Lança `CorridaJaAberta` se outra ganhou a corrida. */
  abrir(
    learnerId: string,
    questId: string,
    iniciadaEm: Date,
    tx: Transacao,
  ): Promise<EstadoDaCorrida>;

  /** Ids das atividades já respondidas nesta jogada. */
  atividadesRespondidas(questRunId: string, tx: Transacao): Promise<ReadonlySet<string>>;

  /** Atualiza posição e pontuação. Chamado a cada tentativa. */
  avancar(
    questRunId: string,
    fase: number,
    pontuacao: number,
    tx: Transacao,
  ): Promise<void>;

  /**
   * Fecha a jogada e marca a recompensa como concedida, **na mesma escrita**.
   *
   * Devolve `false` quando a marca já estava lá — quer dizer que outra
   * requisição concluiu primeiro, e a recompensa não deve sair de novo
   * (docs/08 §5, invariante 3).
   */
  concluir(questRunId: string, quando: Date, tx: Transacao): Promise<boolean>;
}

/** Uma missão como o mapa a conhece — sem as atividades, com a regra. */
export interface MissaoNoMapa {
  readonly ref: string;
  readonly slug: string;
  readonly nome: string;
  readonly tipo: string;
  readonly atividades: number;
  readonly competenciasExigidas: readonly string[];
  readonly desbloqueio: RegraDeDesbloqueio | null;
}

export interface CapituloNoMapa {
  readonly nome: string;
  readonly missoes: readonly MissaoNoMapa[];
}

export interface MundoNoMapa {
  readonly slug: string;
  readonly nome: string;
  readonly academia: string;
  readonly nivelMinimo: number;
  readonly capitulos: readonly CapituloNoMapa[];
}

export interface DadosDoMapa {
  readonly mundos: readonly MundoNoMapa[];
  readonly estado: EstadoParaDesbloqueio;
  /** Referências das missões já concluídas alguma vez. */
  readonly concluidas: ReadonlySet<string>;
  /** Referências das missões com jogada aberta. */
  readonly emAndamento: ReadonlySet<string>;
}

/**
 * Leitura do mapa — fora de transação.
 *
 * Separada de `RepositorioDeMissoes` porque é outra coisa: montar o mapa é uma
 * consulta de tela, não pode abrir transação e nunca deve falhar por corrida.
 * A criança que abre a base tem que ver a base.
 */
export interface LeituraDoMapa {
  mapaDaCrianca(learnerId: string): Promise<DadosDoMapa>;
  /** Estado de desbloqueio da criança, para conferir ao abrir uma missão. */
  estadoDeDesbloqueio(learnerId: string, tx: Transacao): Promise<EstadoParaDesbloqueio>;
}

// ── Seleção adaptativa de slot (docs/08 §7) ─────────────────────────────────

/** O que o seletor precisa saber da criança para montar o pedido de seleção. */
export interface ContextoParaSlots {
  readonly ageBand: string;
  readonly locale: string;
  /**
   * Habilidade Elo por objetivo pedido — na verdade a habilidade da
   * **competência** a que o objetivo pertence, porque é nela que
   * `SkillMastery` mora. Objetivo sem tentativa nenhuma não aparece no mapa;
   * quem lê usa o centro da escala (`ELO.centro`) no lugar.
   */
  readonly habilidadePorObjetivo: ReadonlyMap<string, number>;
}

/** Uma atividade candidata a preencher um slot, com o que o seletor precisa. */
export interface CandidataParaSlot {
  readonly activityId: string;
  readonly type: string;
  readonly dificuldade: number;
  readonly minAgeBand: string;
  readonly maxAgeBand: string;
}

export interface ResolucaoDeSlot {
  readonly stageId: string;
  readonly order: number;
  readonly activityId: string;
}

/**
 * Tudo que a seleção adaptativa lê e grava — fora do domínio porque consulta
 * `Learner`, `Objective`, `SkillMastery`, `Activity` e `Attempt`, e o domínio
 * de `quest` não conhece nenhum deles.
 */
export interface RepositorioDeSlots {
  /** `null` quando a criança não existe (conta excluída, id forjado). */
  contexto(
    learnerId: string,
    objectiveIds: readonly string[],
    tx: Transacao,
  ): Promise<ContextoParaSlots | null>;

  /**
   * Atividades publicadas deste objetivo, no idioma pedido. A faixa etária é
   * filtrada por quem chama — comparar `AgeBand` é regra do domínio, não do
   * acesso a dados.
   */
  candidatas(
    objectiveId: string,
    locale: string,
    tx: Transacao,
  ): Promise<readonly CandidataParaSlot[]>;

  /** Ids de atividade que a criança viu em qualquer missão desde `desde` (docs/08 §7.2). */
  vistasRecentemente(
    learnerId: string,
    desde: Date,
    tx: Transacao,
  ): Promise<ReadonlySet<string>>;

  /** Slots já preenchidos nesta jogada. Chave: `chaveDoSlot` (`stageId:order`). */
  slotsResolvidos(questRunId: string, tx: Transacao): Promise<ReadonlyMap<string, string>>;

  /**
   * Grava as resoluções novas e devolve o mapa **completo** da jogada — as que
   * já existiam mais as novas. Duplicata é ignorada, não é erro: duas abas
   * resolvendo o mesmo slot ao mesmo tempo tendem a calcular a mesma resposta
   * (o seletor é determinístico), e quem perdeu a corrida de escrita ainda
   * precisa saber o que ganhou, para montar a mesma missão que a criança vê.
   */
  resolver(
    questRunId: string,
    resolucoes: readonly ResolucaoDeSlot[],
    tx: Transacao,
  ): Promise<ReadonlyMap<string, string>>;
}

export interface QuestDeps {
  readonly repositorio: RepositorioDeMissoes;
  readonly leitura: LeituraDoMapa;
  readonly slots: RepositorioDeSlots;
  readonly seletor: SeletorDeAtividades;
  readonly unidadeDeTrabalho: UnidadeDeTrabalho;
  readonly barramento: EventBus;
  readonly clock: Clock;
}
