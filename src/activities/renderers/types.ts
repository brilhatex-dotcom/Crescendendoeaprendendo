import type { EvaluationResult } from "../contracts";

/**
 * Contrato que todo componente de atividade cumpre.
 *
 * Genérico no config e na resposta, e **sem nenhuma regra de correção**: o
 * renderer coleta a resposta e a entrega. Quem corrige é o `evaluate` do
 * plugin — o mesmo código que roda no servidor. Se um renderer decidisse
 * sozinho se a criança acertou, existiriam duas verdades sobre acerto, e elas
 * divergiriam no primeiro ajuste.
 */
export interface ActivityRendererProps<TConfig = unknown, TAnswer = unknown> {
  readonly config: TConfig;
  /** Chamado quando a criança confirma a resposta. */
  readonly aoResponder: (resposta: TAnswer) => void;
  /**
   * Resultado da última tentativa, quando já houve uma. O renderer usa
   * `resultado.detalhes` para destacar o que ficou certo ou fora do lugar.
   */
  readonly resultado?: EvaluationResult | undefined;
  /** Bloqueia a interação enquanto a devolutiva está sendo lida. */
  readonly bloqueado: boolean;
}
