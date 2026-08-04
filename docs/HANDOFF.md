# HANDOFF — estado do trabalho

> **Leia este arquivo primeiro, antes de qualquer coisa.**
> Ele existe para que uma nova sessão continue exatamente de onde a anterior parou,
> sem refazer trabalho e sem contradizer decisões já tomadas.
>
> Última atualização: 2026-08-04 · **Etapa 2 concluída — a criança vê a Luz subir**

---

## 1. O que é este projeto

**Crescendo e Aprendendo** — plataforma de desenvolvimento infantil gamificada. A criança
vive uma aventura em sete ilhas do arquipélago **Crescente** e, ao jogar, desenvolve
competências escolares (BNCC), cognitivas, socioemocionais, tecnológicas, criativas,
de vida e de prosperidade.

**Primeira usuária real:** a filha do dono do produto, que está fazendo 7 anos.
Isso define a faixa etária do conteúdo da primeira fase (`SPROUT`, 6–8 anos),
**não o tamanho do sistema** — a decisão explícita do dono foi construir o sistema completo.

**Em produção:** <https://crescendendoeaprendendo.vercel.app> (Vercel + Neon, migration aplicada).

---

## 2. Hierarquia de documentos — leia nesta ordem

| Ordem | Documento | Por quê |
|---|---|---|
| 1º | [`docs/biblia/README.md`](biblia/README.md) | índice da Constituição e tabela de artigos pétreos |
| 2º | [`docs/biblia/volume-1/01-fundamentos.md`](biblia/volume-1/01-fundamentos.md) | os princípios que vetam decisões |
| 3º | [`docs/biblia/volume-1/03-universo.md`](biblia/volume-1/03-universo.md) | o mundo e o **léxico oficial** (§3.5) — vocabulário obrigatório |
| 4º | [`docs/01-arquitetura.md`](01-arquitetura.md) | camadas, módulos, motor de atividades |
| 5º | [`docs/04-modelagem-de-dados.md`](04-modelagem-de-dados.md) | contrato do banco |
| 6º | [`docs/12-roadmap.md`](12-roadmap.md) | ordem de execução técnica |
| 7º | [`docs/13-motor-de-atividades.md`](13-motor-de-atividades.md) | **o motor**: contrato de plugin, conteúdo, guias de extensão |

**A Bíblia Pedagógica é soberana.** Qualquer conflito entre ela e um documento técnico
se resolve a favor da Bíblia. Qualquer pessoa pode recusar uma decisão dizendo
*"isto contraria o Volume 1, Capítulo X"* — e quem propôs é que precisa provar que não contraria.

---

## 3. O que JÁ EXISTE — não refaça

**Etapa 0 concluída.** `npm run verify` verde (126 testes), `npm run test:integration` verde
(4 testes contra Postgres real), `npm run build` verde.

### Fundação
- `package.json` — Next.js 15, React 19, TypeScript, Tailwind 4, Prisma 6, Zod, Vitest, Argon2
- `tsconfig.json` — `strict` + `noUncheckedIndexedAccess`, aliases `@/*`
- `next.config.ts` — `typedRoutes: true` e cabeçalhos de segurança
- `.env.example` — todas as variáveis documentadas, incluindo Resend

### Banco de dados
- **`prisma/schema.prisma` — 45 modelos.** Contrato completo de `docs/04`, 16 bounded contexts.
- `prisma/migrations/` — 3 migrations, todas aplicadas:
  - `..._init` — **53 tabelas, 139 índices, 12 enums**
  - `..._chaves_naturais_de_conteudo` — `sourceRef` em `Activity`/`Chapter`/`Quest` e
    `@@unique([skillId, name])` em `Objective`. Sem chave natural estável, reimportar
    duplicaria atividade — e `Attempt` aponta para `Activity.id`
  - `..._escala_elo_cabe_no_banco` — `Decimal(6,3)` → `(7,3)` em `Activity.difficulty`,
    `Skill.difficultyRef` e `SkillMastery.ability`. A escala Elo do motor usa 800/1000/1200
    e não cabia em 999,999; só apareceu ao rodar a primeira importação de verdade
- Resolvido e **não reabrir sem ADR**: razão contábil (`LedgerEntry`), `idempotencyKey`,
  `pseudonymId` separado do `learnerId`, BKT+Elo, SM-2, `OutboxMessage`, `version`.

### Autenticação — completa (Etapa 0)
Fluxo inteiro funcionando: **cadastro → verificação de e-mail → login → perfil da criança →
PIN → área infantil → saída com PIN.**

- `src/modules/identity/` nas quatro camadas, com `index.ts` como única API pública
  - `domain/` — `Email`, `PlainPassword`, `ParentPin`, `DisplayName`, `GuardianName`,
    `Account`, faixa etária, `avatarConfig` (Zod + `schemaVersion`)
  - `application/` — 10 portas, 11 casos de uso, `policy.ts` com todos os prazos e limites
  - `infrastructure/` — 4 repositórios Prisma, `Argon2Hasher`, rate limiter, mailer, auditoria
  - `presentation/actions.ts` — 7 Server Actions, todas via `createAction`
- `src/composition/identity.ts` — composition root (singleton por instância)
- `src/server/` — `db.ts`, `mailer.ts` (Resend por `fetch`), `session.ts`, `action.ts`
- `src/shared/security/` — `tokens.ts` (geração/hash/`hashIp`), `signing.ts` (HMAC)
- `src/shared/forms/action-state.ts` — estado do formulário, **sem imports** (cliente e servidor)

**Propriedades de segurança já implementadas e testadas** (não relitigar):
resposta idêntica para e-mail inexistente / senha errada / conta excluída · `fakeVerify()`
com o mesmo custo de CPU (anti-enumeração por tempo) · token de sessão de 256 bits guardado
**em hash** · token de verificação de uso único que invalida os anteriores · cadastro com
e-mail existente responde igual e avisa o dono por e-mail · isolamento entre famílias no
`where` da consulta · auditoria sem dado de criança.

### Motor de Atividades — completo (Etapa 1)
**Leia [`docs/13-motor-de-atividades.md`](13-motor-de-atividades.md) antes de mexer aqui.**

- `src/activities/` — núcleo puro e isomórfico: `contracts.ts`, `registry.ts`, `difficulty.ts`,
  `rewards.ts`, `presentation.ts`, `session.ts`, `telemetry.ts`
- `plugins/multiple-choice/` e `plugins/order-sequence/` — o segundo prova a extensibilidade
  (resposta em lista, crédito parcial) sem ter tocado no núcleo
- `plugins/index.ts` e `renderers/index.tsx` — **os dois únicos manifestos** que ganham uma linha
  por tipo novo
- `renderers/` — telas carregadas sob demanda (`next/dynamic`), fora do núcleo
- `renderers/feedback-visual.tsx` — animação e efeito (confete, faíscas, onda de luz) em CSS,
  suprimidos por `prefers-reduced-motion`
- `content/` — acervo como dado: `schema/` (Zod de autoria), `loader.ts`, currículo BNCC de
  demonstração e a missão `missao-01-a-contagem-da-orla` (3 atividades)
- `scripts/validate-content.ts` — `npm run content:validate`, roda no CI
- Rota jogável: `(play)/missao/[slug]` com correção **no servidor**

**Feedback sensorial ligado:** animação por tom, efeito de partícula, tempo de leitura
(`segurarSegundos` trava só o botão, nunca o texto), `mostrarProgresso` e `mostrarPremio`.
**Som não toca** — ver §4.

**Propriedades travadas (não relitigar):**
resultado incorreto sem `ensino` **não compila** (união discriminada) · núcleo não importa React,
Next, Prisma nem `src/modules` (dependency-cruiser) · plugin não importa plugin · `evaluate` é
puro · telemetria não tem campo para `learnerId` · sem Fôlego a criança perde moeda, nunca XP ·
nenhuma informação existe só como movimento, som ou cor.

### Importador de conteúdo — concluído (Etapa 2, passo 1)
`content/` (git) → Postgres. É o que faz `Attempt` ter um `Activity.id` para referenciar.

- `src/modules/content/` nas quatro camadas
  - `domain/plan.ts` — **função pura**: acervo → plano de linhas. Todo o mapeamento é
    testável sem banco, e é onde moram os erros sutis de importação
  - `application/` — porta `EscritorDeConteudo` e caso de uso `importarConteudo`
  - `infrastructure/prisma-content-writer.ts` — `upsert` por chave natural, uma transação
- `src/composition/content.ts` — composition root
- `scripts/import-content.ts` — `npm run content:import` (`-- --forcar` só para diagnóstico)
- `tests/integration/content-import.integration.test.ts` — 6 testes contra Postgres real

**Correspondência entre autoria e banco** (decidida, documentada em `domain/plan.ts`):
competência → `Strand` · objetivo → `Skill` (é o objetivo que carrega código BNCC e
pré-requisito) · `Objective` sintético 1:1 · nível → `World` · módulo → `Chapter` ·
missão → `Quest` · fase → `Stage` · atividade → `Activity` + `StageActivity`.

**Propriedades travadas (não relitigar):**
importação é **tudo-ou-nada** — referência que não fecha não grava nada, porque acervo meio
importado trava a criança numa tela sem saída · é **idempotente** — reimportar preserva
`Activity.id`, e isso é o que protege o histórico de quem já jogou · nada é apagado —
despublicar é decisão editorial separada.

### Avaliação — concluída (Etapa 2, passo 2)
A resposta da criança agora vira histórico, modelo e evento. O ciclo está fechado.

- `src/modules/assessment/` nas quatro camadas
  - `domain/bkt.ts` — Bayesian Knowledge Tracing com os parâmetros de `docs/08 §2`
  - `domain/elo.ts` — habilidade na escala Elo, com trilhos em [400, 2400]
  - `domain/spaced-repetition.ts` — SM-2 adaptado (teto de 120 dias; qualidade derivada do
    desfecho e das dicas, nunca perguntada à criança)
  - `domain/mastery.ts` — junta os dois e decide **quando declarar domínio**
  - `domain/events.ts` — dois tópicos, por necessidades incompatíveis (ver travadas abaixo)
  - `domain/attempt-plan.ts` — **função pura**: contexto + resultado → plano de escrita
  - `application/` — portas `RepositorioDeAvaliacao` e caso de uso `submeterTentativa`
  - `infrastructure/prisma-assessment-repository.ts` — uma transação `READ COMMITTED`
- `src/composition/assessment.ts` — composition root
- `src/server/action.ts` — **passo 5 de `docs/09 §4` implementado**: `idempotente: true` exige
  e valida `chaveDeIdempotencia`, entregue em `ctx.idempotencyKey`
- `app/(play)/missao/[slug]/` — a ação chama `submeterTentativa`; o cliente gera a chave
- `tests/policy/avaliacao.test.ts` — §12.2, §12.7, §11 e §5.2 como testes que quebram o build
- `tests/integration/submit-attempt.integration.test.ts` — 10 testes contra Postgres real
- Migration `20260804120000_versao_em_skillmastery` — `SkillMastery.version`

**Propriedades travadas (não relitigar):**
`submitAttempt` grava `Attempt`, `SkillMastery`, `ReviewCard` e as mensagens de outbox **numa
transação só** · a linha de `SkillMastery` usa **atualização condicional por `version`**, e
conflito faz **reler e recalcular** (nunca reenviar o plano) · **pular não é errar** — grava a
tentativa, não move domínio nem revisão · **domínio alcançado nunca é retirado**; quem decai é a
probabilidade, com piso 0.5 · a **sequência de acertos só conta atividade no nível de referência
ou acima** — sem isso o sistema promoveria a criança pelo que ela já sabia · o prêmio usa a
habilidade **de antes** da tentativa · **dois tópicos de outbox**: o interno leva `learnerId`
(progressão e economia precisam), o de telemetria leva só `pseudonymId` e o tipo não tem o campo
· `assessment` **calcula** o prêmio e **não credita nada**.

### Progressão, economia e entrega de efeitos — concluídas (Etapa 2, passo 3)
O ciclo fecha na tela: a criança responde, a Luz sobe, as Fagulhas entram na carteira.

- **`src/shared/kernel/unit-of-work.ts`** — `Transacao` (handle opaco) e
  `UnidadeDeTrabalho`. Resolve a tensão entre `docs/08 §11` (XP e carteira na **mesma
  transação** da tentativa) e `docs/01 §2` (módulos não se chamam): o caso de uso abre uma
  transação, e quem reage ao evento escreve dentro dela sem conhecer os outros módulos.
- **`src/server/unit-of-work.ts`** — implementação Prisma. **Único lugar** que sabe que uma
  `Transacao` é um `Prisma.TransactionClient`; dois `as unknown as` e mais nada.
- **`src/server/event-bus.ts`** — roda os manipuladores `inline` e grava o outbox, na mesma
  escrita. Nenhum evento sai pelos dois caminhos.
- **`src/modules/progression/`** — Luz, nível, tier, Fôlego, Trilha de Luz, desbloqueios.
  Manipulador `inline` de `assessment.attempt_evaluated`.
- **`src/modules/economy/`** — razão contábil (`LedgerEntry`) e projeção (`Wallet`).
  Manipulador `inline`. Chave derivada da chave da tentativa.
- **`src/server/outbox.ts`** — despachante at-least-once, com backoff e teto de tentativas.
- **`src/server/telemetry.ts`** — `LearningEvent` a partir do tópico pseudonimizado. `outbox`.
- **`app/api/outbox/route.ts`** + `vercel.json` — Cron Job a cada 5 min, **fail-closed**.
- **`app/(play)/hub/painel-de-progresso.tsx`** — Luz, nível, Fagulhas, Fôlego e Trilha na base.
- `tests/policy/progressao-e-economia.test.ts` — §1, §4, §5, §11 e §12 quebram o build.

**Propriedades travadas (não relitigar):**
XP e carteira são gravados **na mesma transação da tentativa**, nunca pelo outbox — pelo outbox,
a criança terminaria a atividade e não veria nada acontecer · **Luz nunca diminui e o nível nunca
desce**; o nível é sempre recalculado do total de Luz, então coluna divergente se corrige sozinha
· **responder nunca gasta Fôlego** — não existe função `gastar` no módulo, e há teste de política
guardando a ausência · o **recorde da Trilha de Luz é preservado** quando a sequência cai, e a
sequência recomeça em **1**, nunca em zero · a Trilha avança **mesmo sem prêmio**: mede presença,
não pontuação · **saldo nunca negativo** e lote de lançamentos é tudo-ou-nada · **nenhuma moeda se
compra com dinheiro real** (teste de política procura por `stripe`, `checkout`, `pagamento`…) ·
o outbox só recebe mensagem de tópico que tem consumidor `outbox` — mensagem que ninguém lê
destruiria a métrica de fila pendente.

### Design System
- `tokens/` — cor e tipografia (já existiam)
- `primitives/` — `Button` (+ `buttonStyles`), `Field`, `Alert`, `Card`; `utils/cn.ts`

### Rotas
- `(marketing)` — `/`, `/para-pais` (CTA de cadastro **recolocado**)
- `(auth)` — `/criar-conta`, `/entrar`, `/verificar-email`
- `(guardian)` — `/familia` (seletor, criar criança, definir PIN)
- `(play)` — `/hub` (lista as missões do acervo) e `/missao/[slug]` (jogável)

### Barreiras de qualidade
- `.dependency-cruiser.cjs` — 10 regras de fronteira, 3 delas do motor (0 erros)
- `eslint.config.mjs` — sem `TODO`, `any`, `dangerouslySetInnerHTML`; fronteiras por camada
- `tests/policy/` — tokens de design **e** motor de atividades
- `.github/workflows/ci.yml` — 3 jobs: verify (+ validação de conteúdo) · integração com Postgres · build
- `vitest.config.ts` (rápido) e `vitest.integration.config.ts` (com banco)

---

## 4. O que NÃO existe ainda

- **`src/modules/quest` não existe.** `QuestRun` não é criado por ninguém e
  `Attempt.questRunId` fica nulo (coluna anulável por desenho). Consequências reais hoje:
  fechar o app no meio da missão perde o lugar; a recompensa de missão (`Quest.rewardXp`,
  `rewardsGrantedAt`) nunca é concedida; **o Fôlego nunca é gasto**, porque quem gasta é quem
  inicia uma missão
- **A Trilha de Luz conta "dia com ≥ 1 tentativa", não "dia com ≥ 1 missão concluída"**
  como diz `docs/08 §6`. Divergência consciente: sem `QuestRun` nenhuma missão conclui, e uma
  sequência que nunca anda seria pior que uma que mede prática real. **Apertar para o critério
  do documento quando `quest` existir** — a função `registrarDia` já está pronta para isso, só
  muda quem a chama
- **Desbloqueio por nível** (Academia da Inteligência no 10, Prosperidade no 15…) — a tabela de
  `docs/08 §1` não está implementada. O que funciona é o desbloqueio **declarado no conteúdo**
  (`premio.desbloqueios` → linhas em `Unlock`). O gate por nível precisa da declaração no lado do
  conteúdo primeiro; pôr os números no código violaria "balanceamento fica em `content/`"
- `LearnerProgress.minutesToday` — fica em 0. Medir tempo de sessão exige marco de início e fim,
  que é assunto de `quest`. Preferi zero honesto a um número inventado
- Conquistas, talentos, notificações e relatórios — o outbox e o barramento já estão prontos;
  falta escrever os manipuladores
- Calibração de dificuldade por telemetria (`docs/08 §2`, job noturno com ≥ 200 tentativas)
- 18 dos 20 tipos de atividade — por decisão explícita
- **Som do feedback** — o vocabulário está no schema e o conteúdo já pode declarar, mas nada toca.
  Faltam os arquivos em `public/sfx/` (identidade sonora, decisão de design) e o respeito a
  `LearnerSettings.soundEnabled`, que exige as preferências da criança chegarem à sessão de missão.
  Ver `docs/13 §10.1`. O resto do feedback sensorial (animação, efeito, tempo de leitura) **está
  funcionando**.
- `prisma/seed/` — sem seeds
- `tests/e2e/` — sem Playwright
- OAuth (Google/Apple) — `OAuthAccount` existe no schema, sem implementação
- Recuperação de senha (`/recuperar`) — o fluxo não existe
- Redis — o rate limiter é em memória; ver §9

---

## 5. PRÓXIMA TAREFA — Etapa 3: a missão como unidade

A Etapa 2 fechou o ciclo da **resposta**: a criança responde, o modelo aprende, a Luz sobe e as
Fagulhas entram. O que falta agora é o ciclo da **missão** — e a lista de coisas que hoje não
funcionam tem todas a mesma causa: `QuestRun` não existe.

### Ordem sugerida
1. **`src/modules/quest/`** — iniciar, retomar e concluir uma jogada.
   - `iniciarMissao` cria o `QuestRun`, **gasta o Fôlego** (5 campanha, 3 revisão, 0 em conteúdo
     novo da trilha e em revisão pendente — `docs/08 §4`) e devolve o estado da jogada;
   - `retomarMissao` devolve a corrida em andamento: fechar o app não pode custar progresso;
   - `concluirMissao` credita `Quest.rewardXp` **uma vez só** (`rewardsGrantedAt`) e publica
     `quest.completed`.
   - `Attempt.questRunId` passa a ser preenchido. A ação de jogo já aceita o campo.
2. **Apertar a Trilha de Luz** para "dia com missão concluída", como manda `docs/08 §6` —
   ver §4. É trocar quem chama `registrarDia`, nada mais.
3. **Regra de desbloqueio** (`docs/08 §3`): `unlockRule` declarativa, avaliada contra nível,
   missões concluídas e domínio médio. O mapa mostra **o caminho**, nunca só um cadeado.
4. **Mapa do mundo** — a base hoje lista missões em texto. `World`, `Chapter` e `Quest` já estão
   no banco, com ordem e `sourceRef`.
5. **Manipuladores que faltam** — conquistas (`Achievement.criteria` é regra declarativa avaliada
   por evento) e perfil de talentos. O barramento e o outbox já estão prontos: é registrar no
   composition root.

### Decisões em aberto — precisam do dono
**1. A importação de conteúdo deve rodar no deploy?** Continua manual (`npm run content:import`).
Colocá-la no `vercel:steps` publicaria o conteúdo a cada deploy — mas os deploys de *preview*
compartilham o `DATABASE_URL` de produção, então uma branch em rascunho escreveria no banco real.
**Jogar exige o acervo importado**: sem ele, `submeterTentativa` responde
`assessment.activity_not_published`.

**2. `CRON_SECRET` precisa ser configurado na Vercel.** Sem ele, `/api/outbox` responde 503 e a
**telemetria nunca é gravada** — a Luz e as Fagulhas continuam funcionando, porque são `inline`.
Gerar um valor de 32+ caracteres, pôr nas variáveis de ambiente do projeto, e o cron de
`vercel.json` (a cada 5 min) passa a rodar.

**3. Fuso do responsável.** A Trilha de Luz conta dias em `America/Sao_Paulo`, fixo em
`prisma-progress-repository.ts`. Não há campo de fuso em `Account`. Para uma família só, está
certo; para vender a uma escola, vira campo.

## 6. Decisões já tomadas — não relitigar

| Decisão | Onde está registrada |
|---|---|
| **Sete** Academias, não seis. Prosperidade é autônoma | Bíblia Cap. 4 e 5 |
| Criança nunca tem conta própria | ADR 0003 |
| Monólito modular + Clean Architecture | ADR 0001 |
| Motor de atividades por plugins tipados | ADR 0002 |
| **Sessão de primeira parte, não Auth.js** | **ADR 0004** |
| **Conteúdo é dado; o motor interpreta, não contém** | ADR 0002 · `docs/13` |
| **Erro incorreto sem `ensino` não compila** | `docs/13 §4` |
| **E-mail transacional: Resend** | decisão do dono, 2026-08-03 |
| Currículo é dado, não código | `docs/01 §4` |
| Fôlego (energia) jamais impede aprender | Bíblia Cap. 6 §6.4 |
| Nenhuma moeda se compra com dinheiro real | Bíblia Cap. 6 §6.5 |
| Nenhuma notificação push vai para criança | Bíblia Cap. 1 PSI3 |
| Erro nunca é vermelho — é coral | Bíblia Cap. 11 §11.2 |
| Modelo do tutor: `claude-sonnet-5` | `src/config/env.ts` |
| Fase 1 = faixa `SPROUT` (6–8 anos) | Bíblia Cap. 2 §2.1 |
| **Chave de idempotência mora na tabela que ela protege, não numa tabela genérica** | `src/server/action.ts` |
| **Uma transação atravessa módulos; quem a abre é o caso de uso** | `src/shared/kernel/unit-of-work.ts` |
| **XP e carteira são `inline`; telemetria é `outbox`** | `src/shared/kernel/domain-event.ts` |
| **`assessment` mede; quem credita reage ao evento** | `src/modules/assessment/domain/events.ts` |
| **Telemetria e evento interno são tópicos separados** | `src/modules/assessment/domain/events.ts` |

---

## 7. Regras inegociáveis ao escrever código

1. **Sem código provisório.** Nada de `TODO`, `FIXME`, mock em produção ou função vazia.
   Funcionalidade não pronta fica atrás de feature flag desligada.
2. **`npm run verify` tem que continuar verde.** Sempre. Antes de qualquer commit.
3. **`typedRoutes` está ligado.** Link para rota inexistente é erro de compilação.
4. **Fronteiras de camada são verificadas.** `domain/` não importa Prisma, Next nem React.
5. **Léxico obrigatório na área infantil** (Bíblia Cap. 3 §3.5): Luz, Fagulhas, Fôlego, Missão,
   Colosso Adormecido, "quase". A palavra **"estudar" não existe** no mundo da criança.
6. **Todo `Json` no schema tem schema Zod correspondente** e `schemaVersion`.
7. **Toda escrita com efeito econômico precisa de `idempotencyKey`.**
8. **Nenhum dado identificável de criança vai para o provedor de IA** — só `pseudonymId`.
9. **Nenhuma Server Action é escrita solta** — sempre por `createAction` (`docs/09 §4`).
10. **Estado de formulário vem de `@/shared/forms/action-state`**, nunca de `@/server/action`:
    importar do segundo arrasta `next/headers` para o cliente e quebra o build.

---

## 8. Comandos

```bash
npm install
cp .env.example .env          # preencher DATABASE_URL e AUTH_SECRET
npx prisma generate
npm run dev                   # http://localhost:3000

npm run verify                # tipos + lint + fronteiras + testes — o que o CI roda
npm run test:integration      # testes com Postgres real (precisa de banco)
npm run content:validate      # valida todo o acervo de conteúdo
npm run build                 # build de produção
npx prisma migrate deploy     # aplica as migrations existentes

# Verificação manual de e-mail — ação de operador, enquanto não há provedor.
# Exige DATABASE_URL; não é acionável pela web; fica na auditoria como SYSTEM.
npm run conta:verificar -- ola@exemplo.com --motivo "primeira conta"
```

### Destravar a própria conta sem provedor de e-mail

Enquanto `RESEND_API_KEY` não estiver configurada, o cadastro cria a conta mas o
e-mail de verificação não sai — e sem verificação não se cria perfil de criança.
Para a conta do dono do produto, use o comando acima:

```bash
npx vercel env pull .env.producao
DATABASE_URL="$(grep '^DATABASE_URL=' .env.producao | cut -d= -f2- | tr -d '"')" \
  npm run conta:verificar -- ola@exemplo.com
```

**Isto vale para a primeira família e mais nada.** A partir da segunda conta,
configure o Resend: e-mail de verificação de verdade é a única prova de
consentimento que vale para uma conta que não é a sua (docs/09 §6).

**Postgres local para os testes de integração**, sem Docker:

```bash
export PGDATA=/var/lib/postgresql/e2e
mkdir -p $PGDATA && chown postgres:postgres $PGDATA && chmod 700 $PGDATA
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $PGDATA -U postgres --auth=trust"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $PGDATA -o '-p 55432' -l /tmp/pg.log start"
psql "postgresql://postgres@127.0.0.1:55432/postgres" -c "CREATE DATABASE crescendo;"
export DATABASE_URL="postgresql://postgres@127.0.0.1:55432/crescendo"
export DIRECT_DATABASE_URL="$DATABASE_URL"
npx prisma migrate deploy && npm run test:integration
```

---

## 9. Armadilhas conhecidas

- **Rate limit é em memória, por instância.** `InMemoryRateLimiter` segura o caso comum (o mesmo
  navegador insistindo) e **não** segura ataque distribuído: com N instâncias quentes na Vercel, o
  limite efetivo é até N × o configurado. A porta `RateLimiter` já está pronta para Redis — quando
  `REDIS_URL` existir, troque a implementação em `src/composition/identity.ts` e mais nada.
- **`RESEND_API_KEY` ainda não está na Vercel.** Sem ela, em produção o envio falha com
  `mail.not_configured` e ninguém consegue verificar e-mail. Passos: criar chave em
  resend.com/api-keys, **verificar o domínio do remetente** (SPF + DKIM) e ajustar `EMAIL_FROM`.
  Sem domínio verificado, o Resend só entrega para o endereço da própria conta.
- **`NEXT_PUBLIC_APP_URL` precisa estar correta na Vercel** — é ela que monta o link de
  verificação. Errada, o e-mail sai com link para `localhost`.
- **`no-warning-comments` usa `location: "start"`**, não `"anywhere"`. Foi mudado de propósito:
  "todo/toda" é palavra corrente em português e a regra proibia prosa legítima. `// TODO:` no
  início do comentário continua barrado — verificado.
- `npm run boundaries` emite 2 **warnings** de "órfão" para os arquivos de token. Esperado:
  eles são consumidos por teste e por CSS, não por import. Warning não quebra o build; erro sim.
- **Jogar exige o acervo importado.** Desde a Etapa 2 passo 2, responder uma atividade lê
  `Activity` pelo `sourceRef`. Num banco sem `npm run content:import`, a criança recebe
  "esta atividade ainda não está publicada". O erro é explícito de propósito — o alternativo
  seria gravar tentativa órfã e descobrir o problema num relatório vazio.
- **`/api/outbox` é fail-closed.** Sem `CRON_SECRET`, responde 503 e a telemetria nunca é
  gravada. Luz e Fagulhas **não** dependem dele — são `inline`, na transação da tentativa. Se
  `LearningEvent` estiver vazio em produção, o segredo é o primeiro lugar para olhar.
- **Mensagem de outbox parada é sintoma, não ruído.** `processedAt` nulo com `attempts` no teto
  significa que um manipulador falha sempre; `lastError` diz qual. A linha não é apagada de
  propósito: mensagem que some é um efeito que ninguém sabe que faltou.
- **`crypto.randomUUID()` exige contexto seguro.** O executor de missão gera a chave de
  idempotência no navegador. Em `http://` que não seja `localhost` a função não existe e o
  envio falha. Em produção é HTTPS; num túnel de teste por HTTP, não.
- `prisma format` reordena o arquivo. Rode antes de commitar para evitar diff sujo.
- O `package.json` tem `prisma.seed`, que o Prisma 7 vai depreciar → `prisma.config.ts`.
- `npm audit` acusa 3 vulnerabilidades **altas** em dependências transitivas do Next
  (`sharp`/libvips, `postcss`). A correção exige Next 16 — mudança de major, fora do escopo
  desta etapa. Avaliar ao planejar a Etapa 1.

---

## 10. Ao terminar uma etapa

1. Rode `npm run verify`, `npm run test:integration` e `npm run build`.
2. **Atualize este arquivo** — mova o que foi feito da seção 5 para a seção 3,
   e escreva a próxima tarefa. Um handoff desatualizado é pior que nenhum.
3. Commit com mensagem descritiva; push na branch de trabalho.
