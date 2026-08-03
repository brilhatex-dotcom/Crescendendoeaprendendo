import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Carga assinada com HMAC-SHA256 — usada no cookie da sub-sessão de criança
 * (docs/09 §2) e em qualquer valor que o cliente guarde e devolva.
 *
 * **Assinado não é cifrado.** O conteúdo continua legível por quem tem o
 * cookie; o que a assinatura garante é que ninguém o *alterou*. Por isso aqui
 * só entra o que pode ser lido sem prejuízo — id de sessão, id de perfil e
 * validade. Nada de nome de criança, nada de e-mail.
 */

const SEPARADOR = ".";

export function sign(payload: string, secret: string): string {
  const assinatura = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}${SEPARADOR}${assinatura}`;
}

/**
 * Devolve a carga apenas se a assinatura confere. Qualquer coisa fora do
 * esperado (formato, assinatura, corrupção) é `null` — o chamador trata como
 * "não autenticado", sem distinguir o motivo.
 */
export function verify(assinado: string, secret: string): string | null {
  const partes = assinado.split(SEPARADOR);
  if (partes.length !== 2) return null;

  const [cargaCodificada, assinatura] = partes;
  if (!cargaCodificada || !assinatura) return null;

  let payload: string;
  try {
    payload = Buffer.from(cargaCodificada, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const esperada = createHmac("sha256", secret).update(payload).digest("base64url");
  const recebida = Buffer.from(assinatura, "utf8");
  const calculada = Buffer.from(esperada, "utf8");

  if (recebida.length !== calculada.length) return null;
  if (!timingSafeEqual(recebida, calculada)) return null;

  return payload;
}
