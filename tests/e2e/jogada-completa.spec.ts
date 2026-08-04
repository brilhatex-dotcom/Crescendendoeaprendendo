import { expect, test, type Page } from "@playwright/test";

import {
  apagarConta,
  contaExiste,
  fecharBanco,
  roteiroDaPrimeiraMissao,
  verificarEmail,
  type RoteiroDaMissao,
} from "./preparo";

/**
 * A JOGADA COMPLETA — do cadastro do responsável ao fim da missão.
 *
 * Este arquivo faz a pergunta que nenhum teste de unidade fazia: **abrindo
 * isto, dá para jogar?** Três defeitos chegaram à tela sem que nada falhasse
 * (ver `playwright.config.ts`), e todos os três apareceriam aqui.
 *
 * O roteiro — qual opção é a certa, em que ordem os números vão — é lido do
 * acervo, nunca escrito no teste. Conteúdo é a parte do sistema feita para
 * mudar toda semana; um teste que soubesse que a resposta é "4" quebraria na
 * primeira missão nova, e alguém o apagaria.
 */

const EMAIL = `e2e-${Date.now()}@teste.local`;
const SENHA = "SenhaDeTeste#2026";
const PIN = "4731";
const APELIDO = "Menina";

let roteiro: RoteiroDaMissao | null = null;

/*
 * Uma página só para a jornada inteira.
 *
 * Playwright dá um contexto novo a cada `test`, e contexto novo é navegador
 * novo: a sessão do responsável morreria entre o cadastro e a entrada da
 * criança. Aqui a jornada é uma sequência — quem cria a conta é quem abre a
 * área infantil —, então ela acontece na mesma página, como acontece na vida.
 */
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }, info) => {
  /*
   * A emulação do projeto (viewport, toque, agente) é copiada na mão. `browser
   * .newContext()` não herda o `use` do projeto, e sem isto o projeto "celular"
   * rodaria em tela de computador — perdendo justamente a largura em que a
   * grade de opções muda de três colunas para duas.
   */
  const emulacao = info.project.use;
  const contexto = await browser.newContext({
    ...(emulacao.viewport !== undefined ? { viewport: emulacao.viewport } : {}),
    ...(emulacao.userAgent !== undefined ? { userAgent: emulacao.userAgent } : {}),
    ...(emulacao.deviceScaleFactor !== undefined
      ? { deviceScaleFactor: emulacao.deviceScaleFactor }
      : {}),
    ...(emulacao.isMobile !== undefined ? { isMobile: emulacao.isMobile } : {}),
    ...(emulacao.hasTouch !== undefined ? { hasTouch: emulacao.hasTouch } : {}),
    ...(emulacao.baseURL !== undefined ? { baseURL: emulacao.baseURL } : {}),
    ...(emulacao.locale !== undefined ? { locale: emulacao.locale } : {}),
    ...(emulacao.timezoneId !== undefined ? { timezoneId: emulacao.timezoneId } : {}),
  });

  page = await contexto.newPage();
  roteiro = await roteiroDaPrimeiraMissao();
});

test.afterAll(async () => {
  await page.close();
  await apagarConta(EMAIL);
  await fecharBanco();
});

/**
 * Preenche e envia o formulário que contém o campo indicado.
 *
 * Mirar pelo formulário, e não pelo primeiro `button[type=submit]` da página,
 * não é preciosismo: o painel da família tem três formulários e um botão de
 * sair. Clicar no primeiro que aparece derruba a sessão — foi o que aconteceu
 * na primeira versão deste roteiro.
 */
async function enviarFormulario(
  page: Page,
  campo: string,
  valores: Record<string, string>,
): Promise<void> {
  const form = page.locator(`form:has([name="${campo}"])`).first();
  for (const [nome, valor] of Object.entries(valores)) {
    const alvo = form.locator(`[name="${nome}"]`);
    if (await alvo.count()) await alvo.first().fill(valor);
  }
  await form.locator('button[type="submit"]').first().click();
}

test.describe("a jogada completa", () => {
  test("o responsável cria a conta, o perfil da criança e o PIN", async () => {
    await page.goto("/criar-conta");
    await enviarFormulario(page, "nome", {
      nome: "Responsável de Teste",
      email: EMAIL,
      senha: SENHA,
    });

    /*
     * A conta é gravada **antes** do envio do e-mail, e a asserção é sobre isso
     * — não sobre a mensagem na tela.
     *
     * Sem `RESEND_API_KEY` o envio falha em produção, de propósito: é melhor o
     * responsável ver "não conseguimos enviar agora" do que esperar um e-mail
     * que nunca sairia. O que não pode acontecer é a conta se perder junto. Se
     * um dia alguém mover a criação para depois do envio, este teste avisa.
     */
    await expect
      .poll(() => contaExiste(EMAIL), { timeout: 10_000 })
      .toBe(true);

    // A prova de posse do e-mail, feita como o operador faz. Ver `preparo.ts`.
    await verificarEmail(EMAIL);

    await page.goto("/entrar");
    await enviarFormulario(page, "email", { email: EMAIL, senha: SENHA });
    await expect(page).toHaveURL(/\/familia/);

    await enviarFormulario(page, "displayName", {
      displayName: APELIDO,
      birthYear: "2019",
      relation: "mãe",
    });
    await expect(page.getByText(APELIDO).first()).toBeVisible();

    await enviarFormulario(page, "pin", { pin: PIN, confirmacao: PIN });

    /*
     * A asserção é sobre o que o PIN **destrava**, e não sobre uma mensagem de
     * sucesso. Sem PIN a área infantil não abre — é ele que tranca a porta de
     * saída (ADR 0003), e por isso o botão de entrar só aparece depois.
     *
     * Sem esperar por isto, o teste terminaria antes de a Server Action
     * responder e o passo seguinte encontraria a família ainda sem PIN.
     */
    await expect(page.getByRole("button", { name: /Entrar como/i })).toBeVisible();
  });

  test("a criança entra na própria base e vê zero, que é a verdade", async () => {
    await page.goto("/familia");
    await page.getByRole("button", { name: /Entrar como/i }).first().click();
    await expect(page).toHaveURL(/\/hub/);

    await expect(page.getByText(`Oi, ${APELIDO}`)).toBeVisible();

    /*
     * Nunca inventamos progresso para encher a tela (Bíblia Cap. 6). Quem nunca
     * jogou tem zero de Luz e zero Fagulhas — e é isso que precisa aparecer.
     */
    const painel = page.getByRole("region", { name: /progresso/i });
    await expect(painel).toContainText("Nível 1");
    await expect(painel).toContainText("0");
  });

  test("a missão só começa quando a criança toca em Começar", async () => {
    test.skip(!roteiro, "Acervo sem missão jogável.");

    await page.goto(`/missao/${roteiro!.slug}`);

    /*
     * Abrir custa Fôlego, e o Next pré-carrega links. Se a missão começasse no
     * render, olhar o mapa cobraria por missões nunca jogadas — por isso existe
     * uma tela de abertura, e por isso ela é verificada aqui.
     */
    await expect(page.getByRole("button", { name: /Começar/i })).toBeVisible();
    await page.getByRole("button", { name: /Começar/i }).click();

    await expect(page.getByText(/1 de/)).toBeVisible();
  });

  test("errar mostra o ensino e NÃO entrega a resposta", async () => {
    test.skip(!roteiro, "Acervo sem missão jogável.");
    const primeiro = roteiro!.passos[0];
    test.skip(primeiro?.tipo !== "MULTIPLE_CHOICE", "A primeira atividade não é de escolha.");

    await abrirMissao(page, roteiro!);

    if (primeiro?.tipo !== "MULTIPLE_CHOICE") return;

    await page.getByRole("radio", { name: primeiro.errada, exact: true }).click();
    await page.getByRole("button", { name: "Responder" }).click();

    // A escolha dela fica marcada, com o que observar da próxima vez.
    await expect(page.getByText("Foi o que você escolheu")).toBeVisible();
    await expect(page.getByRole("button", { name: /Tentar de novo/i })).toBeVisible();

    /*
     * **A regra que este teste existe para guardar.** A resposta certa não
     * pode aparecer enquanto ainda dá para tentar: o `ensino` é obrigatório em
     * toda opção incorreta (o schema não compila sem), e entregar a resposta no
     * mesmo instante joga fora exatamente o que essa obrigação compra.
     */
    await expect(page.getByText("Resposta certa")).toHaveCount(0);
  });

  test("a jogada retoma onde parou, termina, e a base registra o que ela fez", async () => {
    test.skip(!roteiro, "Acervo sem missão jogável.");

    await abrirMissao(page, roteiro!);

    /*
     * **A promessa central de `QuestRun`, verificada de verdade.**
     *
     * O teste anterior deixou a primeira atividade respondida (errada, mas
     * respondida). Abrir a missão de novo tem que devolver a criança na
     * *segunda* — fechar o app não pode custar progresso. Por isso o roteiro
     * continua de onde ela está, em vez de recomeçar do zero: se um dia a
     * retomada quebrar e a missão voltar para o começo, é aqui que aparece.
     */
    const posicao = await posicaoAtual(page);
    expect(posicao).toBeGreaterThan(0);

    for (const passo of roteiro!.passos.slice(posicao)) {
      if (passo.tipo === "MULTIPLE_CHOICE") {
        await responderEscolha(page, passo.certa);
      } else {
        await responderOrdem(page, passo.ordem);
      }
      await avancar(page);
    }

    await expect(page.getByText(/Missão concluída/i)).toBeVisible();
    // O prêmio da missão é concedido uma vez, e aparece porque aconteceu.
    await expect(page.getByText(/de Luz/)).toBeVisible();

    await page.goto("/hub");
    const painel = page.getByRole("region", { name: /progresso/i });

    /*
     * Os números da base são os que a jogada produziu — não há tela que invente
     * progresso. O Fôlego caiu porque abrir a missão custou; a Trilha andou
     * porque a missão foi **concluída**, não porque ela respondeu (docs/08 §6).
     */
    await expect(painel).not.toContainText("100/100");
    await expect(painel).toContainText("1");

    await expect(page.getByText(/já concluída/i)).toBeVisible();
  });
});

// ── Passos da jogada ─────────────────────────────────────────────────────────

async function abrirMissao(page: Page, missao: RoteiroDaMissao): Promise<void> {
  await page.goto(`/missao/${missao.slug}`);
  const comecar = page.getByRole("button", { name: /Começar/i });
  if (await comecar.count()) await comecar.click();
  await expect(page.getByRole("button", { name: /Responder|Conferir/ })).toBeVisible();
}

/**
 * Em que atividade a criança está, contando do zero.
 *
 * Lê o "N de M" do cabeçalho — é o mesmo número que ela vê, e por isso o mesmo
 * que precisa estar certo.
 */
async function posicaoAtual(page: Page): Promise<number> {
  const cabecalho = await page.getByText(/\d+ de \d+/).first().innerText();
  const n = Number(cabecalho.split(" de ")[0]?.trim());
  return Number.isFinite(n) ? n - 1 : 0;
}

async function responderEscolha(page: Page, texto: string): Promise<void> {
  await page.getByRole("radio", { name: texto, exact: true }).click();
  await page.getByRole("button", { name: "Responder" }).click();
}

/**
 * Coloca os itens na ordem certa usando as setas.
 *
 * Ordenação por seleção: acha o item que deveria estar na posição `i`, e o sobe
 * até lá. É mais passos que arrastar, e é assim que a criança faz — o renderer
 * usa setas de propósito, porque arrastar é difícil para mão pequena e
 * impossível para leitor de tela.
 */
async function responderOrdem(page: Page, alvo: readonly string[]): Promise<void> {
  for (let posicao = 0; posicao < alvo.length; posicao += 1) {
    const desejado = alvo[posicao];
    if (!desejado) continue;

    for (let guarda = 0; guarda < alvo.length; guarda += 1) {
      const atual = await page.locator("ol li").allInnerTexts();
      const ondeEsta = atual.findIndex((linha, i) => i >= posicao && contem(linha, desejado));

      if (ondeEsta <= posicao) break;
      await page.getByRole("button", { name: `Mover ${desejado} para cima` }).click();
    }
  }

  await page.getByRole("button", { name: "Conferir" }).click();
}

/** O texto da linha traz a posição e os rótulos das setas junto com o item. */
const contem = (linha: string, item: string): boolean =>
  linha.split("\n").some((parte) => parte.trim() === item);

async function avancar(page: Page): Promise<void> {
  const continuar = page.getByRole("button", { name: /Continuar|Seguir em frente/ });
  await expect(continuar.first()).toBeEnabled({ timeout: 15_000 });
  await continuar.first().click();
}
