/**
 * MÓDULO QUEST — API pública.
 *
 * A missão como unidade: abrir, acompanhar e fechar uma jogada. A promessa que
 * este módulo existe para cumprir é uma só — **fechar o app nunca custa
 * progresso**.
 *
 * Ele não gasta Fôlego, não credita Luz e não mexe em carteira. Publica
 * `quest.started` e `quest.completed`; quem entende de cada coisa reage.
 *
 * Fronteira do módulo: quem está de fora importa daqui e de mais nenhum lugar.
 */

export {
  criarAbrirJogada,
  criarConcluirJogada,
  type AbrirJogada,
  type ConcluirJogada,
  type JogadaAberta,
  type JogadaConcluida,
} from "./application/play-quest";

export { criarAvancoDaCorrida } from "./application/advance-run";

export {
  criarMontarMapa,
  type CapituloDoMapa,
  type MapaVisual,
  type MissaoDoMapa,
  type MontarMapa,
  type MundoDoMapa,
  type NoDoMapaVisual,
} from "./application/map";

export {
  CorridaJaAberta,
  type CandidataParaSlot,
  type ContextoParaSlots,
  type DadosDoMapa,
  type ItemDaFilaDeRevisao,
  type LeituraDoMapa,
  type MissaoNoMapa,
  type QuestDeps,
  type RepositorioDeMissoes,
  type RepositorioDeSlots,
  type ResolucaoDeSlot,
} from "./application/ports";

export {
  DOMINIO_DO_COLOSSO,
  avaliarDesbloqueio,
  regraDeDesbloqueioSchema,
  regraEfetiva,
  type EstadoParaDesbloqueio,
  type Jogabilidade,
  type Pendencia,
  type RegraDeDesbloqueio,
} from "./domain/unlock-rule";

export {
  LAYOUT_VAZIO,
  layoutDoMapaSchema,
  type ArestaDoLayout,
  type LayoutDoMapa,
  type NoDoLayout,
} from "./domain/map-layout";

export {
  TOPICO_MISSAO_CONCLUIDA,
  TOPICO_MISSAO_INICIADA,
  chaveDaRecompensa,
  type MissaoConcluida,
  type MissaoIniciada,
} from "./domain/events";

export {
  CUSTO_DE_FOLEGO,
  TIPOS_DE_MISSAO,
  custoDeFolego,
  type TipoDeMissao,
} from "./domain/energy-cost";

export {
  atividadesRestantes,
  missaoConcluida,
  posicaoDaRetomada,
  type AtividadeDaMissao,
  type DadosDaMissao,
  type EstadoDaCorrida,
  type PremioDaMissao,
  type SlotPendente,
  type StatusDaCorrida,
} from "./domain/quest-run";

export { type RegraDeSlot, regraDeSlotSchema } from "./domain/slot-rule";

export {
  criarResolverSlots,
  type ResolverSlots,
} from "./application/resolve-slots";
