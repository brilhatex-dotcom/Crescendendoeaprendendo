import { containerDeAvaliacao } from "@/composition/assessment";
import { serverEnv } from "@/config/env";

/**
 * Despacho do outbox — os efeitos que podem esperar.
 *
 * O que precisa ser atômico com a tentativa (Luz, Fagulhas) **não passa por
 * aqui**: aquilo roda dentro da transação (docs/08 §11). Esta rota entrega o
 * resto — telemetria hoje; relatório, notificação e IA depois.
 *
 * Chamada pelo Cron Job da Vercel a cada 5 minutos (`vercel.json`). Não há
 * processo longo numa plataforma sem servidor: o modelo é pulso, não daemon.
 *
 * `force-dynamic` porque a rota tem efeito; uma resposta em cache aqui faria o
 * cron "rodar" sem processar nada, e a fila cresceria em silêncio.
 */
export const dynamic = "force-dynamic";

export async function GET(requisicao: Request): Promise<Response> {
  const autorizado = verificarSegredo(requisicao);
  if (!autorizado.ok) return autorizado.resposta;

  const { despachante } = containerDeAvaliacao();
  const relatorio = await despachante.despachar();

  /*
   * Falha em manipulador não vira erro HTTP: a mensagem foi reagendada com
   * backoff e continua na fila. Devolver 500 faria o cron da Vercel marcar a
   * execução como falha e um alarme dispararia para algo que já tem tratamento
   * próprio. O número vai no corpo, que é onde se olha.
   */
  return Response.json(relatorio);
}

/**
 * Também aceita POST, porque é assim que um disparo manual costuma vir — e
 * porque um dia o despacho vai ser chamado logo depois de uma ação, para a
 * telemetria não esperar o próximo pulso.
 */
export const POST = GET;

type Verificacao = { ok: true } | { ok: false; resposta: Response };

function verificarSegredo(requisicao: Request): Verificacao {
  const segredo = serverEnv.CRON_SECRET;

  if (!segredo) {
    /*
     * Fail-closed. Sem segredo configurado, ninguém despacha — nem a Vercel,
     * nem um curioso. O oposto deixaria a rota aberta exatamente no ambiente
     * em que ela ainda não foi pensada.
     */
    return {
      ok: false,
      resposta: Response.json(
        { erro: "CRON_SECRET não configurado. O despacho fica desligado até que esteja." },
        { status: 503 },
      ),
    };
  }

  const cabecalho = requisicao.headers.get("authorization");
  if (cabecalho !== `Bearer ${segredo}`) {
    // Sem detalhe no corpo: uma mensagem que distingue "faltou" de "está
    // errado" ajuda quem está tentando adivinhar.
    return { ok: false, resposta: new Response(null, { status: 401 }) };
  }

  return { ok: true };
}
