/**
 * TRILHA DE LUZ (docs/08 §6) — a sequência de dias.
 *
 * O desenho inteiro é uma resposta a uma pergunta: como fazer alguém querer
 * voltar amanhã **sem** usar culpa? A resposta do produto tem três partes, e
 * todas estão aqui:
 *
 *  · **Lanternas** (escudos): faltar um dia consome uma lanterna em vez de
 *    zerar. Uma a cada 5 dias, no máximo 2.
 *  · **O recorde é preservado.** A sequência pode cair a zero; o recorde não.
 *    Perder de vez o número que representa meses de esforço é o que faz alguém
 *    desistir de vez.
 *  · **Nenhuma notificação de culpa.** O lembrete opcional vai ao responsável,
 *    nunca à criança (Bíblia Cap. 1 PSI3). Não há nada neste arquivo que
 *    dispare mensagem — e é assim que tem que continuar.
 *
 * Arquivo puro. A data chega já no fuso do responsável: comparar dias em UTC
 * viraria sequência quebrada para quem joga à noite.
 */

export const TRILHA = {
  /** Uma lanterna a cada 5 dias de sequência. */
  diasPorLanterna: 5,
  maximoDeLanternas: 2,
} as const;

export interface EstadoDaTrilha {
  readonly dias: number;
  readonly recorde: number;
  readonly lanternas: number;
  /** Último dia com atividade, no fuso do responsável. `null` = nunca jogou. */
  readonly ultimoDia: string | null;
}

/**
 * Registra um dia de atividade.
 *
 * `hoje` e `ultimoDia` são datas civis (`AAAA-MM-DD`) e não instantes: "ontem"
 * é uma pergunta sobre o calendário de quem joga, não sobre 24 horas corridas.
 */
export function registrarDia(atual: EstadoDaTrilha, hoje: string): EstadoDaTrilha {
  if (atual.ultimoDia === hoje) return atual;

  const faltou = diasEntreDatas(atual.ultimoDia, hoje) - 1;

  const dias = proximaSequencia(atual, faltou);
  const lanternas = proximasLanternas(atual, faltou, dias);

  return {
    dias,
    // O recorde é a memória do que ela já conseguiu. Nunca desce.
    recorde: Math.max(atual.recorde, dias),
    lanternas,
    ultimoDia: hoje,
  };
}

function proximaSequencia(atual: EstadoDaTrilha, faltou: number): number {
  if (atual.ultimoDia === null) return 1;
  if (faltou <= 0) return atual.dias + 1;

  /*
   * Faltou. Cada lanterna cobre um dia; se cobrir todos, a sequência continua
   * como se nada tivesse acontecido — que é exatamente a promessa feita à
   * criança quando ela ganhou a lanterna.
   */
  if (faltou <= atual.lanternas) return atual.dias + 1;

  // Sem cobertura: recomeça em 1, contando o dia de hoje. Zero seria dizer que
  // ela não jogou hoje, e ela jogou.
  return 1;
}

function proximasLanternas(
  atual: EstadoDaTrilha,
  faltou: number,
  dias: number,
): number {
  const gastas = faltou > 0 ? Math.min(faltou, atual.lanternas) : 0;
  const restantes = atual.lanternas - gastas;

  // Ganha uma ao completar cada múltiplo de 5 dias de sequência.
  const ganhou = dias > 0 && dias % TRILHA.diasPorLanterna === 0 ? 1 : 0;

  return Math.min(TRILHA.maximoDeLanternas, restantes + ganhou);
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Distância em dias civis. `0` quando não havia dia anterior. */
function diasEntreDatas(anterior: string | null, atual: string): number {
  if (!anterior) return 0;
  const de = Date.parse(`${anterior}T00:00:00Z`);
  const ate = Date.parse(`${atual}T00:00:00Z`);
  if (Number.isNaN(de) || Number.isNaN(ate)) return 0;
  return Math.max(0, Math.round((ate - de) / MS_POR_DIA));
}

/**
 * Data civil de um instante, num fuso.
 *
 * `en-CA` porque é o *locale* que formata como `AAAA-MM-DD` — ordenável e
 * comparável por igualdade de texto. `pt-BR` daria `DD/MM/AAAA`, que ordena
 * errado e transformaria a comparação de datas numa fonte de defeitos.
 */
export function diaCivil(instante: Date, fuso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: fuso,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instante);
  } catch {
    // Fuso inválido vindo de configuração: melhor um dia em UTC do que uma
    // exceção no meio da jogada.
    return instante.toISOString().slice(0, 10);
  }
}
