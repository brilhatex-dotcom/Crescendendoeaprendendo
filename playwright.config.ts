import { defineConfig, devices } from "@playwright/test";

/**
 * TESTES DE PONTA A PONTA — a jogada como a criança vive.
 *
 * ── Por que este arquivo existe ──
 * Três defeitos chegaram à tela sem que um único teste falhasse:
 *
 *  1. uma pergunta que apontava para conchas que não estavam na tela;
 *  2. a resposta certa marcada com o coral de "tente de novo";
 *  3. a resposta certa revelada no erro, tornando o "tente de novo" inútil.
 *
 * Os três eram invisíveis para teste de unidade porque **cada peça estava
 * correta isoladamente**. O `evaluate` devolvia o que prometia, o schema
 * validava, o renderer renderizava. O que ninguém perguntava era a única coisa
 * que importava: abrindo isto, dá para jogar?
 *
 * É a pergunta que este conjunto faz — e é por isso que ele roda um navegador
 * de verdade contra um Postgres de verdade, em vez de montar componentes com
 * dublês. Um teste que monta a tela por dentro teria passado nos três casos.
 *
 * ── Sobre a versão do Playwright ──
 * Está fixada em `~1.56` de propósito: é a que casa com o Chromium disponível
 * no ambiente de desenvolvimento remoto (revisão 1194). Subir de minor sem
 * subir o navegador dá "executable doesn't exist", que é um erro difícil de ler
 * e fácil de evitar.
 */
export default defineConfig({
  testDir: "./tests/e2e",

  /*
   * O acervo vai para o banco antes de tudo. Jogar exige `Quest.sourceRef`
   * gravado, e um conjunto que depende de alguém ter rodado um comando antes é
   * um conjunto que falha no CI por motivo errado.
   */
  globalSetup: "./tests/e2e/preparo-global.ts",

  /*
   * Sem paralelismo entre arquivos: todos falam com o mesmo banco, e a jogada
   * é uma sequência — abrir a missão, responder, concluir. Rodar em paralelo
   * faria um teste apagar o progresso do outro no meio.
   */
  fullyParallel: false,
  workers: 1,

  /* Uma repetição no CI absorve lentidão de máquina compartilhada; zero local,
   * porque teste que passa na segunda tentativa é teste que esconde defeito. */
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    /* Rastro só do que falhou: guardar tudo enche o artefato do CI sem uso. */
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      /*
       * A primeira usuária tem sete anos e vai jogar no celular ou no tablet.
       * A grade de opções muda de três colunas para duas nessa largura, e é
       * exatamente o tipo de coisa que só quebra onde ninguém olha.
       */
      name: "celular",
      use: { ...devices["Pixel 7"] },
    },
  ],

  /*
   * Sobe o servidor de produção, não o de desenvolvimento: é o que a criança
   * vai acessar. `reuseExistingServer` evita esperar dois minutos quando já há
   * um `npm run dev` aberto na máquina de quem está trabalhando.
   */
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
