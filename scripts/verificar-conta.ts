/**
 * Verifica manualmente o e-mail de uma conta — **ação de operador**.
 *
 * ── Por que isto existe ──
 * A trava é legítima: nenhum perfil de criança nasce antes de o responsável
 * provar que é dono do e-mail (docs/09 §6 — consentimento parental). Mas
 * enquanto o produto tem uma única família — a do próprio dono — exigir um
 * provedor de e-mail configurado só para destravar a própria conta é atrito
 * sem contrapartida de segurança: quem roda este comando já tem a string de
 * conexão do banco, ou seja, já podia editar a linha na mão.
 *
 * ── Por que isto NÃO enfraquece a regra ──
 * · não é rota, não é Server Action, não é acionável pela web;
 * · exige DATABASE_URL, que só quem opera a infraestrutura tem;
 * · fica na trilha de auditoria como ação de SISTEMA, com o motivo declarado;
 * · a trava continua valendo para todo mundo que se cadastrar pelo site.
 *
 * Quando houver famílias além da sua, configure RESEND_API_KEY e aposente este
 * atalho: e-mail de verificação de verdade é a única prova que vale para uma
 * conta que não é a sua.
 *
 * Uso:
 *   npm run conta:verificar -- ola@exemplo.com
 *   npm run conta:verificar -- ola@exemplo.com --motivo "primeira conta"
 */

import { PrismaClient } from "@prisma/client";

const MOTIVO_PADRAO = "verificacao manual pelo operador";

async function main(): Promise<number> {
  const argumentos = process.argv.slice(2);
  const email = argumentos.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();

  if (!email) {
    console.error(
      [
        "Informe o e-mail da conta.",
        "",
        "  npm run conta:verificar -- ola@exemplo.com",
        "",
      ].join("\n"),
    );
    return 1;
  }

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
        "    npm run conta:verificar -- " + email,
        "",
      ].join("\n"),
    );
    return 1;
  }

  const db = new PrismaClient();

  try {
    const conta = await db.account.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, name: true, status: true, emailVerifiedAt: true },
    });

    if (!conta) {
      console.error(
        `Nenhuma conta ativa com o e-mail ${email}.\n` +
          "Crie a conta pelo site primeiro, em /criar-conta.",
      );
      return 1;
    }

    // Idempotente: rodar duas vezes não é erro nem gera segunda linha de auditoria.
    if (conta.emailVerifiedAt) {
      console.log(
        `A conta de ${conta.name} (${email}) já estava verificada desde ` +
          `${conta.emailVerifiedAt.toISOString()}. Nada a fazer.`,
      );
      return 0;
    }

    const agora = new Date();

    await db.$transaction([
      db.account.update({
        where: { id: conta.id },
        data: { emailVerifiedAt: agora, status: "ACTIVE" },
      }),
      // Uma verificação sem e-mail precisa deixar rastro. Quem auditar depois
      // tem que conseguir distinguir esta conta das que confirmaram pelo link.
      db.auditLog.create({
        data: {
          actorType: "SYSTEM",
          actorId: null,
          action: "identity.email_verified_manually",
          targetType: "Account",
          targetId: conta.id,
          diff: { motivo, origem: "scripts/verificar-conta.ts" },
        },
      }),
      // Tokens pendentes viram lixo: o link antigo não deve mais valer.
      db.verificationToken.deleteMany({ where: { identifier: conta.id } }),
    ]);

    console.log(
      [
        "",
        `  Conta de ${conta.name} (${email}) verificada.`,
        `  Motivo registrado na auditoria: "${motivo}"`,
        "",
        "  Agora você já pode criar o perfil da criança em /familia.",
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
    console.error("Falha ao verificar a conta:", causa);
    process.exit(1);
  });
