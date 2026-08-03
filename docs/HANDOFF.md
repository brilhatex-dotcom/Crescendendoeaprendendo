# HANDOFF — estado do trabalho

> **Leia este arquivo primeiro, antes de qualquer coisa.**
> Ele existe para que uma nova sessão continue exatamente de onde a anterior parou,
> sem refazer trabalho e sem contradizer decisões já tomadas.
>
> Última atualização: 2026-08-03 · **Etapa 0 concluída** (autenticação completa)

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
- `prisma/migrations/20260803200611_init/` — **53 tabelas, 139 índices, 12 enums.**
  Já aplicada em produção. Não gere outra sem necessidade real.
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

### Design System
- `tokens/` — cor e tipografia (já existiam)
- `primitives/` — `Button` (+ `buttonStyles`), `Field`, `Alert`, `Card`; `utils/cn.ts`

### Rotas
- `(marketing)` — `/`, `/para-pais` (CTA de cadastro **recolocado**)
- `(auth)` — `/criar-conta`, `/entrar`, `/verificar-email`
- `(guardian)` — `/familia` (seletor, criar criança, definir PIN)
- `(play)` — `/hub` (base mínima da criança; guarda tripla de sub-sessão)

### Barreiras de qualidade
- `.dependency-cruiser.cjs` — 7 regras de fronteira (0 erros)
- `eslint.config.mjs` — sem `TODO`, `any`, `dangerouslySetInnerHTML`; fronteiras por camada
- `.github/workflows/ci.yml` — 3 jobs: verify · **integração com Postgres** · build
- `vitest.config.ts` (rápido) e `vitest.integration.config.ts` (com banco)

---

## 4. O que NÃO existe ainda

- `src/activities/` — **o motor de plugins (ADR 0002) não existe**
- `src/modules/` além de `identity` — nenhum outro bounded context
- `content/` — nenhum conteúdo autorado
- `prisma/seed/` — sem seeds
- `tests/e2e/` — sem Playwright
- OAuth (Google/Apple) — `OAuthAccount` existe no schema, sem implementação
- Recuperação de senha (`/recuperar`) — **o fluxo não existe**; ver §5
- Redis — o rate limiter é em memória; ver §9

---

## 5. PRÓXIMA TAREFA — Etapa 1: motor de atividades e primeira missão

Objetivo: **a criança abre uma missão, responde, recebe devolutiva e vê a ilha acender.**

O motor é a peça mais importante da arquitetura. **Leia `docs/01 §3` e o
[ADR 0002](adr/0002-motor-de-atividades-por-plugins.md) antes de escrever qualquer linha dele.**

### Ordem sugerida
1. `src/activities/contracts.ts` — `ActivityPlugin`, `EvaluationResult`, contextos
2. `src/activities/registry.ts` — mapa `type → plugin` (Open/Closed)
3. Primeiro plugin: `multiple-choice/` (`schema.ts`, `evaluate.ts`, `Renderer.tsx`, `index.ts`, teste)
4. `content/` — schema Zod de autoria + validador em CI + primeiro pacote de missões SPROUT
5. `src/modules/assessment/` e `src/modules/progression/` — tentativa, domínio, Trilha de Luz
6. `(play)/missao/[questId]` — sessão de gameplay
7. Substituir o `/hub` provisório pelo HUD real (Luz, Fôlego, Fagulhas)

### Dívidas pequenas, quando tocar na área
- **Idempotência no `createAction`.** O passo 5 de `docs/09 §4` ainda não existe, de propósito:
  não há ação com efeito econômico hoje, e a chave mora em `LedgerEntry`, não numa tabela
  genérica. **É pré-requisito da primeira ação de carteira** — implemente junto com ela.
- **Recuperação de senha.** `/recuperar` está previsto em `docs/02` e não existe. A infraestrutura
  já está pronta (`VerificationToken`, mailer, `revokeAllForAccount`): é um caso de uso novo,
  não uma fundação nova.
- **Redis para rate limit.** Ver §9.

---

## 6. Decisões já tomadas — não relitigar

| Decisão | Onde está registrada |
|---|---|
| **Sete** Academias, não seis. Prosperidade é autônoma | Bíblia Cap. 4 e 5 |
| Criança nunca tem conta própria | ADR 0003 |
| Monólito modular + Clean Architecture | ADR 0001 |
| Motor de atividades por plugins tipados | ADR 0002 |
| **Sessão de primeira parte, não Auth.js** | **ADR 0004** |
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
npm run build                 # build de produção
npx prisma migrate deploy     # aplica as migrations existentes
```

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
