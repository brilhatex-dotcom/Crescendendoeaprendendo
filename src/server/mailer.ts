import { serverEnv, isProduction } from "@/config/env";
import { ok, err, unavailable, type Result } from "@/shared/kernel";

/**
 * Transporte de e-mail transacional.
 *
 * Provedor escolhido: **Resend** (decisão do dono do produto, 2026-08-03).
 * Falamos com a API por `fetch` em vez do SDK — a superfície que usamos é um
 * único POST, e uma dependência a menos é uma dependência a menos para auditar
 * num produto que lida com dados de criança.
 *
 * Este módulo conhece apenas *transporte*. O conteúdo de cada e-mail é problema
 * do módulo que o envia, através de uma porta estreita na camada de aplicação.
 */

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Sempre enviamos texto puro junto: cliente de e-mail que bloqueia HTML é comum. */
  readonly text: string;
  readonly html: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<Result<void>>;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

class ResendMailer implements Mailer {
  readonly #apiKey: string;
  readonly #from: string;

  constructor(apiKey: string, from: string) {
    this.#apiKey = apiKey;
    this.#from = from;
  }

  async send(message: EmailMessage): Promise<Result<void>> {
    let response: Response;
    try {
      response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.#from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
    } catch {
      // Rede fora do ar. A mensagem não menciona o destinatário: log sem PII.
      return err(
        unavailable("mail.transport_unreachable", "Provedor de e-mail inacessível."),
      );
    }

    if (!response.ok) {
      const detalhe = await response.text().catch(() => "");
      return err(
        unavailable(
          "mail.send_failed",
          `Provedor de e-mail recusou o envio (HTTP ${response.status}): ${detalhe.slice(0, 200)}`,
        ),
      );
    }

    return ok(undefined);
  }
}

/**
 * Adaptador de desenvolvimento: imprime o e-mail no terminal.
 *
 * Existe para que o fluxo de verificação seja testável sem provedor configurado
 * — não é mock em produção, e a fábrica abaixo garante que ele nunca é
 * escolhido quando `NODE_ENV=production`.
 */
class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<Result<void>> {
    process.stdout.write(
      [
        "",
        "┌─ e-mail (adaptador de console — nada foi enviado de verdade) ─────",
        `│ para:    ${message.to}`,
        `│ assunto: ${message.subject}`,
        "├───────────────────────────────────────────────────────────────────",
        message.text
          .split("\n")
          .map((linha) => `│ ${linha}`)
          .join("\n"),
        "└───────────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return ok(undefined);
  }
}

/**
 * Sem chave em produção não inventamos um caminho feliz: toda tentativa de
 * envio falha alto, com erro tratável. É melhor que o responsável veja
 * "não conseguimos enviar agora" do que ficar esperando um e-mail que nunca
 * sairia.
 */
class UnconfiguredMailer implements Mailer {
  async send(): Promise<Result<void>> {
    return err(
      unavailable(
        "mail.not_configured",
        "RESEND_API_KEY não está definida — nenhum e-mail pode ser enviado.",
      ),
    );
  }
}

export function createMailer(): Mailer {
  const apiKey = serverEnv.RESEND_API_KEY;
  if (apiKey) return new ResendMailer(apiKey, serverEnv.EMAIL_FROM);
  return isProduction ? new UnconfiguredMailer() : new ConsoleMailer();
}
