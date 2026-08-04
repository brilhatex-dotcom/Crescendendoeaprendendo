# HANDOFF — estado do trabalho

> **Leia este arquivo primeiro, antes de qualquer coisa.**
> Ele existe para que uma nova sessão continue exatamente de onde a anterior parou,
> sem refazer trabalho e sem contradizer decisões já tomadas.
>
> Última atualização: 2026-08-04 · **Etapa 2 em curso — importador de conteúdo concluído**

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

- `src/modules/` além de `identity` — **`assessment`, `progression`, `economy`, `quest` não existem**
- Persistência de tentativas — o contrato `RegistradorDeTentativas` existe; a gravação em
  `Attempt`/`LearningEvent` é do `assessment`
- BKT e Elo — fórmulas especificadas em `docs/08 §2`, cálculo ainda não implementado
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

## 5. PRÓXIMA TAREFA — Etapa 2, passo 2: tentativa persistida

O passo 1 (importador) está feito: o acervo já vive no Postgres e `Activity.id` existe.
Falta fechar o ciclo — hoje a criança joga, o servidor corrige, e nada fica gravado.

### Ordem sugerida
1. **`src/modules/assessment/`** — caso de uso `submitAttempt`: grava `Attempt`, atualiza
   `SkillMastery` (BKT + Elo de `docs/08 §2`), agenda `ReviewCard` (SM-2). Publica o evento
   `AttemptEvaluated` no outbox, na mesma transação.
2. **Idempotência no `createAction`** — o passo 5 de `docs/09 §4` ainda não existe.
   `submitAttempt` é a primeira ação com efeito econômico: **implemente junto**.
3. **`src/modules/progression/`** — XP, nível, Fôlego, desbloqueios. **Reage** ao evento,
   não é chamado pelo `assessment` (`docs/01 §2`).
4. **`src/modules/economy/`** — carteira com razão contábil e `idempotencyKey`.
5. **`QuestRun` retomável** — fechar o app no meio da missão não pode custar progresso.

### Decisão em aberto — precisa do dono
**A importação de conteúdo deve rodar no deploy?** Hoje é comando manual
(`npm run content:import`). Colocá-la no `vercel:steps` publicaria o conteúdo a cada deploy,
sem passo manual — mas os deploys de *preview* compartilham o `DATABASE_URL` de produção,
então uma branch em rascunho escreveria no banco real. Enquanto não houver banco separado
por ambiente, deixei fora do build de propósito.

### Depois
Mapa visual do mundo, mais tipos de atividade conforme o conteúdo pedir, tutor IA.

---

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
