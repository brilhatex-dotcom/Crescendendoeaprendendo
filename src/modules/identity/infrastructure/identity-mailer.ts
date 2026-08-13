import type { Mailer } from "@/server/mailer";
import type { Result } from "@/shared/kernel";

import type { Email } from "../domain";
import type {
  EmailDeRedefinicao,
  EmailDeVerificacao,
  IdentityMailer,
} from "../application/ports";

/**
 * Conteúdo dos e-mails de identidade.
 *
 * O transporte é de `@/server/mailer`; o que se escreve é deste módulo. Os
 * textos falam com um adulto: sem gamificação, sem léxico do Arquipélago, sem
 * urgência artificial. Quem lê está decidindo se confia o dado de uma criança a
 * um produto — o tom é o de quem explica, não o de quem vende.
 */
export class TransactionalIdentityMailer implements IdentityMailer {
  readonly #mailer: Mailer;

  constructor(mailer: Mailer) {
    this.#mailer = mailer;
  }

  async enviarVerificacao(dados: EmailDeVerificacao): Promise<Result<void>> {
    const horas = Math.round(
      (dados.expiraEm.getTime() - Date.now()) / (60 * 60 * 1000),
    );

    return this.#mailer.send({
      to: dados.para.value,
      subject: "Confirme seu e-mail — Crescendo e Aprendendo",
      text: [
        `Olá, ${dados.nome}.`,
        "",
        "Confirme seu e-mail para terminar de criar a conta:",
        dados.url,
        "",
        `O link vale por ${horas} horas e só pode ser usado uma vez.`,
        "",
        "Se não foi você quem pediu, ignore esta mensagem — nenhuma conta será ativada.",
        "",
        "— Crescendo e Aprendendo",
      ].join("\n"),
      html: layout({
        titulo: "Confirme seu e-mail",
        corpo: [
          `<p>Olá, ${escapar(dados.nome)}.</p>`,
          "<p>Confirme seu e-mail para terminar de criar a conta.</p>",
          botao(dados.url, "Confirmar meu e-mail"),
          `<p style="color:#6b7280;font-size:14px">O link vale por ${horas} horas e só pode ser usado uma vez.</p>`,
          '<p style="color:#6b7280;font-size:14px">Se não foi você quem pediu, ignore esta mensagem — nenhuma conta será ativada.</p>',
        ].join(""),
      }),
    });
  }

  /**
   * Resposta ao cadastro com e-mail que já existe.
   *
   * A tela diz a mesma coisa nos dois casos (para não virar oráculo de contas);
   * é este e-mail que impede o dono da conta de ficar sem explicação.
   */
  async enviarAvisoDeContaExistente(dados: {
    readonly para: Email;
    readonly nome: string;
    readonly urlEntrar: string;
  }): Promise<Result<void>> {
    return this.#mailer.send({
      to: dados.para.value,
      subject: "Alguém tentou criar uma conta com o seu e-mail",
      text: [
        `Olá, ${dados.nome}.`,
        "",
        "Alguém preencheu o formulário de cadastro com este e-mail, que já tem conta aqui.",
        "Nenhuma conta nova foi criada e nada mudou na sua.",
        "",
        "Se foi você, é só entrar normalmente:",
        dados.urlEntrar,
        "",
        "Se não foi você, não precisa fazer nada. Sua senha continua valendo e ninguém teve acesso à conta.",
        "",
        "— Crescendo e Aprendendo",
      ].join("\n"),
      html: layout({
        titulo: "Alguém tentou criar uma conta com o seu e-mail",
        corpo: [
          `<p>Olá, ${escapar(dados.nome)}.</p>`,
          "<p>Alguém preencheu o formulário de cadastro com este e-mail, que já tem conta aqui. <strong>Nenhuma conta nova foi criada</strong> e nada mudou na sua.</p>",
          botao(dados.urlEntrar, "Entrar na minha conta"),
          '<p style="color:#6b7280;font-size:14px">Se não foi você, não precisa fazer nada. Sua senha continua valendo e ninguém teve acesso à conta.</p>',
        ].join(""),
      }),
    });
  }

  async enviarRedefinicaoDeSenha(dados: EmailDeRedefinicao): Promise<Result<void>> {
    const minutos = Math.round(
      (dados.expiraEm.getTime() - Date.now()) / (60 * 1000),
    );

    return this.#mailer.send({
      to: dados.para.value,
      subject: "Redefinir sua senha — Crescendo e Aprendendo",
      text: [
        `Olá, ${dados.nome}.`,
        "",
        "Pediram para trocar a senha desta conta. Se foi você, escolha uma senha nova aqui:",
        dados.url,
        "",
        `O link vale por ${minutos} minutos e só pode ser usado uma vez.`,
        "",
        "Se não foi você quem pediu, ignore esta mensagem — sua senha continua a mesma.",
        "",
        "— Crescendo e Aprendendo",
      ].join("\n"),
      html: layout({
        titulo: "Redefinir sua senha",
        corpo: [
          `<p>Olá, ${escapar(dados.nome)}.</p>`,
          "<p>Pediram para trocar a senha desta conta. Se foi você, escolha uma senha nova pelo botão abaixo.</p>",
          botao(dados.url, "Escolher senha nova"),
          `<p style="color:#6b7280;font-size:14px">O link vale por ${minutos} minutos e só pode ser usado uma vez.</p>`,
          '<p style="color:#6b7280;font-size:14px">Se não foi você quem pediu, ignore esta mensagem — sua senha continua a mesma.</p>',
        ].join(""),
      }),
    });
  }
}

/**
 * Escapa texto vindo do usuário antes de entrar no HTML do e-mail.
 *
 * React não está aqui para escapar por nós, e o nome é digitado por quem se
 * cadastra. Cliente de e-mail que renderiza HTML renderiza injeção também.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Estilo em atributo `style`: cliente de e-mail ignora folha de estilo. */
function botao(url: string, rotulo: string): string {
  return `<p style="margin:28px 0"><a href="${url}" style="background:#7C5CFF;border-radius:14px;color:#ffffff;display:inline-block;font-weight:700;padding:14px 26px;text-decoration:none">${rotulo}</a></p>`;
}

function layout({ titulo, corpo }: { titulo: string; corpo: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="background:#f6f5fb;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;color:#1f2937;line-height:1.6;max-width:560px;padding:36px">
<tr><td>
<h1 style="color:#4C1D95;font-size:22px;margin:0 0 20px">${titulo}</h1>
${corpo}
<hr style="border:0;border-top:1px solid #e5e7eb;margin:32px 0">
<p style="color:#6b7280;font-size:13px;margin:0">Crescendo e Aprendendo — o Arquipélago Crescente.<br>Este e-mail foi enviado porque alguém usou este endereço em nosso cadastro.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}
