/**
 * Números da política de identidade, em um só lugar.
 *
 * Espalhar "30 dias" e "4 horas" pelo código é como sessão de criança acaba
 * durando o mesmo que sessão de adulto por descuido de cópia.
 * Origem dos valores: docs/09 §2 e §5.
 */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

export const DURACAO = {
  /** Sessão adulta: 30 dias. Responsável não deveria relogar toda semana. */
  sessaoAdulta: 30 * DIA,
  /**
   * Sub-sessão de criança: 4 horas. Curta de propósito — o tablet fica na
   * sala, e uma sessão que dura o dia inteiro é uma porta aberta.
   */
  sessaoCrianca: 4 * HORA,
  /** Link de verificação de e-mail: 24 horas. */
  tokenDeVerificacao: 24 * HORA,
  /**
   * Link de redefinição de senha: 1 hora, não 24. Quem pode ler o e-mail que
   * chegou nas últimas 24h já pode trocar a senha da conta — janela mais curta
   * reduz esse risco sem incomodar quem clica logo depois de pedir.
   */
  tokenDeRedefinicaoSenha: 1 * HORA,
} as const;

export const LIMITES = {
  /** docs/09 §5 — login 5/min/IP. */
  login: { limite: 5, janelaMs: MINUTO },
  /** docs/09 §5 — criação de conta 3/h/IP. */
  criacaoDeConta: { limite: 3, janelaMs: HORA },
  /** Reenvio de verificação: 3/h por conta. Evita usar o produto como spam-cannon. */
  reenvioDeVerificacao: { limite: 3, janelaMs: HORA },
  /** Pedido de redefinição de senha: 3/h por conta — mesmo raciocínio do reenvio. */
  pedidoDeRedefinicao: { limite: 3, janelaMs: HORA },
  /** PIN: 5 tentativas por hora. O adversário é uma criança curiosa, não um botnet. */
  pin: { limite: 5, janelaMs: HORA },
  /** Teto de crianças por conta familiar — número de família, não de escola. */
  criancasPorConta: 8,
} as const;
