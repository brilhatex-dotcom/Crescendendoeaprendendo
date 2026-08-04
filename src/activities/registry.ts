import { err, ok, notFound, validationError, type Result } from "@/shared/kernel";

import type {
  ActivityPlugin,
  ActivityType,
  EvaluationContext,
  EvaluationResult,
  SealedPlugin,
} from "./contracts";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  REGISTRO DE PLUGINS — o núcleo do motor
 *
 *  Este arquivo não menciona nenhum tipo de atividade. Nunca vai mencionar.
 *  Adicionar múltipla escolha, sudoku, robótica ou reconhecimento de voz não
 *  muda uma linha daqui.
 *
 *  O que muda é o MANIFESTO (`plugins/index.ts`), que ganha uma linha por
 *  plugin novo. Essa separação é o que "não modificar o núcleo" significa na
 *  prática: registrar exige *algum* ponto de registro; o que não pode é a
 *  lógica do motor conhecer os tipos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Fecha os genéricos de um plugin atrás de uma fachada que fala em dado cru.
 *
 * Esta é a **única** função do sistema onde o tipo concreto de um plugin se
 * perde — e ela é type-safe por dentro, porque aqui `TConfig` e `TAnswer` ainda
 * existem. Todo o resto do motor trabalha com `SealedPlugin` e nunca precisa de
 * `any` nem de casting.
 */
export function selar<TConfig, TAnswer>(
  plugin: ActivityPlugin<TConfig, TAnswer>,
): SealedPlugin {
  function lerConfig(bruto: unknown): Result<TConfig> {
    const analise = plugin.configSchema.safeParse(bruto);
    if (analise.success) return ok(analise.data);
    return err(
      validationError(
        "activity.config_invalid",
        `Conteúdo inválido para a atividade ${plugin.type}.`,
        { tipo: plugin.type, problemas: analise.error.issues.map(descreverProblema) },
      ),
    );
  }

  function lerResposta(bruto: unknown): Result<TAnswer> {
    const analise = plugin.answerSchema.safeParse(bruto);
    if (analise.success) return ok(analise.data);
    return err(
      validationError(
        "activity.answer_invalid",
        "Resposta em formato inesperado.",
        { tipo: plugin.type, problemas: analise.error.issues.map(descreverProblema) },
      ),
    );
  }

  return {
    type: plugin.type,
    rendererId: plugin.rendererId,

    validarConfig: (bruto) => lerConfig(bruto),
    validarResposta: (bruto) => lerResposta(bruto),

    probabilidadeDeChute(configBruta) {
      const config = lerConfig(configBruta);
      if (!config.ok) return config;
      return ok(plugin.probabilidadeDeChute(config.value));
    },

    /**
     * Valida as duas pontas e corrige, nesta ordem. Não existe caminho que
     * avalie sem validar: a única porta de entrada é esta.
     *
     * Validar a config na leitura, e não só na autoria, é o que protege contra
     * conteúdo antigo com formato defasado — o custo de `schemaVersion` sem
     * validação na leitura é descobrir o problema na cara da criança.
     */
    avaliar(configBruta, respostaBruta, ctx) {
      const config = lerConfig(configBruta);
      if (!config.ok) return config;

      const resposta = lerResposta(respostaBruta);
      if (!resposta.ok) return resposta;

      return ok(plugin.evaluate(config.value, resposta.value, ctx));
    },
  };
}

function descreverProblema(problema: { path: PropertyKey[]; message: string }): string {
  const caminho = problema.path.join(".");
  return caminho ? `${caminho}: ${problema.message}` : problema.message;
}

// ── O registro ───────────────────────────────────────────────────────────────

export interface ActivityRegistry {
  /** Plugin do tipo, ou erro NOT_FOUND se ninguém o registrou. */
  obter(type: string): Result<SealedPlugin>;
  /** Tipos jogáveis hoje. Usado pelo validador de conteúdo e pelo painel. */
  tiposDisponiveis(): readonly ActivityType[];
  suporta(type: string): boolean;
}

/**
 * Monta um registro a partir de uma lista de plugins.
 *
 * Recebe a lista em vez de importá-la: é o que permite testar o motor com
 * plugins de mentira e, mais importante, é o que impede este arquivo de
 * conhecer o manifesto. A dependência aponta do manifesto para o núcleo, nunca
 * o contrário.
 */
export function criarRegistro(
  plugins: readonly SealedPlugin[],
): ActivityRegistry {
  const porTipo = new Map<string, SealedPlugin>();

  for (const plugin of plugins) {
    if (porTipo.has(plugin.type)) {
      // Falha na inicialização, não em produção. Dois plugins para o mesmo tipo
      // significa que a correção de uma atividade dependeria da ordem de import.
      throw new Error(
        `Dois plugins registrados para o tipo "${plugin.type}". Cada tipo tem exatamente um.`,
      );
    }
    porTipo.set(plugin.type, plugin);
  }

  return {
    obter(type) {
      const plugin = porTipo.get(type);
      if (!plugin) {
        return err(
          notFound(
            "activity.plugin_not_registered",
            `Nenhum plugin registrado para o tipo "${type}".`,
          ),
        );
      }
      return ok(plugin);
    },

    tiposDisponiveis() {
      return [...porTipo.keys()].sort() as ActivityType[];
    },

    suporta(type) {
      return porTipo.has(type);
    },
  };
}

/**
 * Corrige uma resposta usando o registro. É a função que o caso de uso de
 * tentativa chama — e a única coisa que ele precisa saber sobre o motor.
 */
export function avaliarAtividade(
  registro: ActivityRegistry,
  atividade: { readonly type: string; readonly config: unknown },
  resposta: unknown,
  ctx: EvaluationContext,
): Result<EvaluationResult> {
  const plugin = registro.obter(atividade.type);
  if (!plugin.ok) return plugin;
  return plugin.value.avaliar(atividade.config, resposta, ctx);
}
