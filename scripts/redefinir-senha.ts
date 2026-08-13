/**
 * Redefine manualmente a senha de uma conta — **ação de operador**.
 *
 * ── Por que isto existe ──
 * Não existe ainda um fluxo de "esqueci minha senha" pelo site (precisaria de
 * token por e-mail, como a verificação de cadastro já tem — ver
 * `scripts/verificar-conta.ts` para o raciocínio idêntico). Enquanto isso não
 * é construído, quem já tem `DATABASE_URL` da produção — ou seja, quem já
 * podia editar a linha na mão — usa este atalho para a própria conta.
 *
 * A senha nova passa pela MESMA validação (`PlainPassword.create`) e pelo
 * MESMO hasher (`Argon2Hasher`) que o cadastro usa, então o login funciona
 * exatamente como se a senha tivesse sido trocada pela tela.
 *
 * Toda sessão ativa da conta é revogada — trocar a senha e continuar logado
 * em todo lugar que já tinha um cookie válido anularia o propósito da troca.
 *
 * Uso:
 *   npm run conta:redefinir-senha -- ola@exemplo.com "uma frase longa e nova"
 *   npm run conta:redefinir-senha -- ola@exemplo.com "..." --motivo "esqueci a senha"
 */

import { PrismaClient } from "@prisma/client";

import { Argon2Hasher } from "../src/modules/identity/infrastructure/argon2-hasher";
import { PlainPassword } from "../src/modules/identity/domain/password";

const MOTIVO_PADRAO = "redefinicao manual pelo operador";

async function main(): Promise<number> {
  const argumentos = process.argv.slice(2);
  const posicionais = argumentos.filter((arg) => !arg.startsWith("--"));
  const [email, novaSenha] = posicionais;

  if (!email || !novaSenha) {
    console.error(
      [
        "Informe o e-mail da conta e a senha nova.",
        "",
        '  npm run conta:redefinir-senha -- ola@exemplo.com "uma frase longa e nova"',
        "",
      ].join("\n"),
    );
    return 1;
  }

  const emailNormalizado = email.trim().toLowerCase();

  const indiceDoMotivo = argumentos.indexOf("--motivo");
  const motivo =
    indiceDoMotivo >= 0 ? (argumentos[indiceDoMotivo + 1] ?? MOTIVO_PADRAO) : MOTIVO_PADRAO;

  if (!process.env.DATABASE_URL) {
    console.error(
      [
        "DATABASE_URL não está definida.",
        "",
        "Para agir sobre o banco de produção, puxe as variáveis da Vercel:",
        "  npx vercel env pull .env.producao",
        "  DATABASE_URL=\"$(grep '^DATABASE_URL=' .env.producao | cut -d= -f2- | tr -d '\\\"')\" \\",
        `    npm run conta:redefinir-senha -- ${emailNormalizado} "..."`,
        "",
      ].join("\n"),
    );
    return 1;
  }

  const senha = PlainPassword.create(novaSenha, emailNormalizado);
  if (!senha.ok) {
    console.error(`Senha recusada: ${senha.error.message}`);
    return 1;
  }

  const db = new PrismaClient();

  try {
    const conta = await db.account.findFirst({
      where: { email: emailNormalizado, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!conta) {
      console.error(
        `Nenhuma conta ativa com o e-mail ${emailNormalizado}.\n` +
          "Confira se digitou certo o e-mail usado no cadastro.",
      );
      return 1;
    }

    const hasher = new Argon2Hasher();
    const passwordHash = await hasher.hash(senha.value.reveal());
    const agora = new Date();

    await db.$transaction([
      db.account.update({
        where: { id: conta.id },
        data: { passwordHash },
      }),
      // Toda sessão com cookie antigo para de valer — a troca de senha
      // precisa exigir login de novo em qualquer lugar já conectado.
      db.session.updateMany({
        where: { accountId: conta.id, revokedAt: null },
        data: { revokedAt: agora },
      }),
      db.auditLog.create({
        data: {
          actorType: "SYSTEM",
          actorId: null,
          action: "identity.password_reset_manually",
          targetType: "Account",
          targetId: conta.id,
          diff: { motivo, origem: "scripts/redefinir-senha.ts" },
        },
      }),
    ]);

    console.log(
      [
        "",
        `  Senha de ${conta.name} (${emailNormalizado}) redefinida.`,
        `  Motivo registrado na auditoria: "${motivo}"`,
        "  Todas as sessões antigas foram encerradas — faça login de novo em /entrar.",
        "",
      ].join("\n"),
    );
    return 0;
  } finally {
    await db.$disconnect();
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((causa: unknown) => {
    console.error("Falha ao redefinir a senha:", causa);
    process.exit(1);
  });
