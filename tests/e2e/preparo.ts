import { PrismaClient } from "@prisma/client";

import { carregarAcervo } from "@/content/loader";

/**
 * Preparo dos testes de ponta a ponta.
 *
 * Duas coisas moram aqui, e as duas por um motivo:
 *
 * · **a verificação de e-mail**, que no produto acontece por link enviado pelo
 *   Resend. Em teste não há caixa de entrada, e a mesma ação existe como
 *   comando de operador (`npm run conta:verificar`). Fazê-la por Prisma é a
 *   versão programática desse comando — não é atalho na regra: o cadastro pela
 *   web continua exigindo a prova de posse do e-mail;
 *
 * · **as respostas certas**, lidas do acervo em vez de escritas no teste. Um
 *   teste que soubesse que "4" é a resposta quebraria quando o conteúdo
 *   mudasse — e o conteúdo é a parte do sistema feita para mudar toda semana.
 *   Lendo de `content/`, ele continua valendo enquanto houver uma missão.
 */

const db = new PrismaClient();

export async function fecharBanco(): Promise<void> {
  await db.$disconnect();
}

/** A conta existe no banco? Usado para provar que o cadastro gravou. */
export async function contaExiste(email: string): Promise<boolean> {
  const conta = await db.account.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  return conta !== null;
}

/** A ação de operador, em código. Ver o comentário do arquivo. */
export async function verificarEmail(email: string): Promise<void> {
  await db.account.update({
    where: { email: email.toLowerCase() },
    data: { emailVerifiedAt: new Date(), status: "ACTIVE" },
  });
}

/** Apaga a família do teste. `onDelete: Cascade` leva o resto junto. */
export async function apagarConta(email: string): Promise<void> {
  const conta = await db.account.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, guardianships: { select: { learnerId: true } } },
  });
  if (!conta) return;

  const learnerIds = conta.guardianships.map((g) => g.learnerId);

  // Filho antes do pai: o que não tem cascata sai na mão.
  await db.attempt.deleteMany({ where: { learnerId: { in: learnerIds } } });
  await db.questRun.deleteMany({ where: { learnerId: { in: learnerIds } } });
  await db.learner.deleteMany({ where: { id: { in: learnerIds } } });
  await db.account.delete({ where: { id: conta.id } });
}

// ── O roteiro da missão, lido do acervo ──────────────────────────────────────

export interface EscolhaCerta {
  readonly tipo: "MULTIPLE_CHOICE";
  /** Texto da opção correta — é por ele que o teste clica. */
  readonly certa: string;
  /** Texto de uma opção errada, para exercitar o caminho do erro. */
  readonly errada: string;
}

export interface OrdemCerta {
  readonly tipo: "ORDER_SEQUENCE";
  /** Textos dos itens, na ordem que o conteúdo declara como correta. */
  readonly ordem: readonly string[];
}

export type PassoDaMissao = EscolhaCerta | OrdemCerta;

export interface RoteiroDaMissao {
  readonly slug: string;
  readonly nome: string;
  readonly passos: readonly PassoDaMissao[];
}

/**
 * Monta o roteiro da primeira missão do acervo.
 *
 * Devolve `null` quando o acervo não tem missão jogável — nesse caso o teste
 * se declara pulado em vez de falhar, porque um acervo vazio é uma decisão de
 * conteúdo, não um defeito de código.
 */
export async function roteiroDaPrimeiraMissao(): Promise<RoteiroDaMissao | null> {
  const { acervo } = await carregarAcervo();
  const carregada = acervo.missoes[0];
  if (!carregada) return null;

  const passos: PassoDaMissao[] = [];

  for (const fase of carregada.missao.fases) {
    for (const atividade of fase.atividades) {
      const passo = passoDaAtividade(atividade.tipo, atividade.config);
      // Tipo ainda sem roteiro conhecido: o teste para de andar aqui em vez de
      // fingir que jogou a missão inteira.
      if (!passo) return { slug: carregada.missao.slug, nome: carregada.missao.nome, passos };
      passos.push(passo);
    }
  }

  return { slug: carregada.missao.slug, nome: carregada.missao.nome, passos };
}

function passoDaAtividade(tipo: string, config: unknown): PassoDaMissao | null {
  if (tipo === "MULTIPLE_CHOICE") {
    const { opcoes } = config as {
      opcoes: { texto: string; correta: boolean }[];
    };
    const certa = opcoes.find((o) => o.correta);
    const errada = opcoes.find((o) => !o.correta);
    if (!certa || !errada) return null;
    return { tipo: "MULTIPLE_CHOICE", certa: certa.texto, errada: errada.texto };
  }

  if (tipo === "ORDER_SEQUENCE") {
    const { itens, ordemCorreta } = config as {
      itens: { id: string; texto: string }[];
      ordemCorreta: string[];
    };
    const porId = new Map(itens.map((i) => [i.id, i.texto]));
    const ordem = ordemCorreta.map((id) => porId.get(id) ?? "");
    if (ordem.some((t) => t === "")) return null;
    return { tipo: "ORDER_SEQUENCE", ordem };
  }

  return null;
}
