# HANDOFF — estado do trabalho

> **Leia este arquivo primeiro, antes de qualquer coisa.**
> Ele existe para que uma nova sessão continue exatamente de onde a anterior parou,
> sem refazer trabalho e sem contradizer decisões já tomadas.
>
> Última atualização: 2026-08-03 · commit de referência: `864edcc` (merge do PR #1 na `main`)

---

## 1. O que é este projeto

**Crescendo e Aprendendo** — plataforma de desenvolvimento infantil gamificada. A criança
vive uma aventura em sete ilhas do arquipélago **Crescente** e, ao jogar, desenvolve
competências escolares (BNCC), cognitivas, socioemocionais, tecnológicas, criativas,
de vida e de prosperidade.

**Primeira usuária real:** a filha do dono do produto, que está fazendo 7 anos.
Isso define a faixa etária do conteúdo da primeira fase (`SPROUT`, 6–8 anos),
**não o tamanho do sistema** — a decisão explícita do dono foi construir o sistema completo.

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

Etapa 0 parcialmente concluída. Tudo abaixo está na `main`, funcionando, com `npm run verify` verde.

### Fundação
- `package.json` — Next.js 15, React 19, TypeScript, Tailwind 4, Prisma 6, Zod, Vitest
- `tsconfig.json` — `strict` + `noUncheckedIndexedAccess`, aliases `@/*`
- `next.config.ts` — `typedRoutes: true` e cabeçalhos de segurança (HSTS, Permissions-Policy)
- `postcss.config.mjs`, `vitest.config.ts`
- `.env.example` — todas as variáveis documentadas

### Banco de dados
- **`prisma/schema.prisma` — 45 modelos, validado.** É o contrato completo de `docs/04`.
  Cobre os 16 bounded contexts: identidade, criança, currículo, conteúdo, missões,
  avaliação, progressão, economia, coleção, tutor IA, talentos, escola, notificação,
  telemetria, auditoria, plataforma.
- Pontos que já estão resolvidos no schema e **não devem ser reabertos sem ADR**:
  razão contábil (`LedgerEntry`), `idempotencyKey` em toda escrita econômica,
  `pseudonymId` separado do `learnerId`, BKT+Elo em `SkillMastery`, SM-2 em `ReviewCard`,
  `OutboxMessage`, `version` para atualização condicional em linhas quentes.

### Código
- `src/shared/kernel/` — `Result` (erro é valor), `DomainEvent` + `AggregateRoot`, `Clock` injetável
- `src/config/env.ts` — validação de ambiente por Zod na inicialização
- `src/design-system/tokens/color.ts` — 3 camadas, 3 modos de superfície, 7 paletas de academia
- `src/design-system/tokens/typography.ts` — escala por faixa etária
- `app/globals.css` — tokens em `@theme` do Tailwind 4, reset, acessibilidade
- `app/layout.tsx` — fontes Baloo 2 + Nunito por `next/font`, metadata, viewport
- `app/(marketing)/page.tsx` — landing (estática)
- `app/(marketing)/para-pais/page.tsx` — página de confiança (estática)

### Barreiras de qualidade (todas verdes)
- `.dependency-cruiser.cjs` — 7 regras de fronteira entre camadas
- `eslint.config.mjs` — proíbe `TODO`/`FIXME`, `any`, `dangerouslySetInnerHTML`,
  e import de framework dentro de `domain/` e `application/`
- `src/shared/kernel/result.test.ts` — 5 testes
- `tests/policy/design-tokens.test.ts` — 13 **testes de política** (regras da Constituição)
- `.github/workflows/ci.yml` — typecheck, lint, fronteiras, testes, build

---

## 4. O que NÃO existe ainda

Nenhuma destas pastas foi criada. Não presuma que existem:

- `src/modules/` — **nenhum bounded context implementado ainda**
- `src/activities/` — o motor de plugins de atividade (ADR 0002) não existe
- `src/server/` — sem `db.ts`, sem `action.ts`, sem `cache.ts`, sem adaptadores
- `src/composition/` — composition root não existe
- `src/design-system/primitives/` e `game/` — nenhum componente, só tokens
- `content/` — nenhum conteúdo autorado
- `prisma/migrations/` — **nenhuma migration foi gerada** (nunca houve banco)
- `prisma/seed/` — sem seeds
- `tests/e2e/` — sem Playwright

---

## 5. PRÓXIMA TAREFA — Etapa 0, parte restante: autenticação

Objetivo: **um responsável cria conta, verifica e-mail, cria o perfil da criança e entra na
área infantil.** É o critério de aceite da Etapa 0 em `docs/12-roadmap.md`.

### Pré-requisito bloqueante
Não existe banco de dados provisionado.

O caminho escolhido é provisionar pela **Vercel** (Storage → Neon), não criando conta no
Neon separadamente. As variáveis entram sozinhas no projeto e o deploy aplica a migration:
o script `vercel-build` roda `prisma migrate deploy` antes do build.

A migration inicial **já existe e já foi validada** contra PostgreSQL 16
(`prisma/migrations/20260803200611_init/` — 53 tabelas, 139 índices, 12 enums).
Não gere outra: aplique a que existe.

Para desenvolver localmente, basta `DATABASE_URL` no `.env`.
`scripts/with-direct-db.mjs` resolve a conexão direta sozinho.

### Ordem sugerida
1. `src/server/db.ts` — singleton do `PrismaClient` sobre a string pooled
2. `src/modules/identity/` nas quatro camadas (`domain`, `application`, `infrastructure`, `presentation`),
   com `index.ts` como única API pública do módulo
3. `src/server/action.ts` — o wrapper `createAction`, que aplica **nesta ordem**
   (`docs/09 §4`): sessão → política → validação Zod → rate limit → idempotência →
   caso de uso → auditoria. **Nenhuma Server Action é escrita solta.**
4. Auth.js v5 com adaptador Prisma customizado — nossos modelos foram renomeados
   (`OAuthAccount`, não `Account`; `Session` tem `activeLearnerId`)
5. Hash de senha com Argon2id (`@node-rs/argon2`)
6. Rotas: `/criar-conta`, `/entrar`, `/verificar-email`, `/familia`
7. Sub-sessão de criança com escopo `play:*`, 4h, saída protegida por PIN (ADR 0003)

### Decisão em aberto — precisa do dono do produto
**Provedor de e-mail transacional** (verificação de conta, recuperação de senha).
Ainda não foi escolhido. Sem isso o fluxo de verificação não fecha.
Não invente um provedor: pergunte.

### Depois da autenticação
Motor de atividades (`src/activities/`) + primeira missão jogável. Ver `docs/12-roadmap.md`
Etapa 1. O motor é a peça mais importante da arquitetura — leia `docs/01 §3` e o
[ADR 0002](adr/0002-motor-de-atividades-por-plugins.md) **antes** de escrever qualquer linha dele.

---

## 6. Decisões já tomadas — não relitigar

| Decisão | Onde está registrada |
|---|---|
| **Sete** Academias, não seis. Prosperidade é autônoma | Bíblia Cap. 4 e 5 |
| Criança nunca tem conta própria | ADR 0003 |
| Monólito modular + Clean Architecture | ADR 0001 |
| Motor de atividades por plugins tipados | ADR 0002 |
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
   O lint quebra o build. Funcionalidade não pronta fica atrás de feature flag desligada.
2. **`npm run verify` tem que continuar verde.** Sempre. Antes de qualquer commit.
3. **`typedRoutes` está ligado.** Link para rota que não existe é erro de compilação —
   crie a rota antes de linkar para ela.
4. **Fronteiras de camada são verificadas.** `domain/` não importa Prisma, Next nem React.
   `application/` depende de portas, não de implementações. Design System não conhece módulos.
5. **Léxico obrigatório na área infantil** (Bíblia Cap. 3 §3.5): Luz (não "pontos"),
   Fagulhas (não "moedas"), Fôlego (não "energia"), Missão (não "exercício"),
   Colosso Adormecido (não "chefão"), "quase" (não "errado"). A palavra **"estudar" não existe**
   no mundo da criança. Nas áreas adulta e escolar, vocabulário técnico e honesto.
6. **Todo `Json` no schema tem schema Zod correspondente** e `schemaVersion`.
7. **Toda escrita com efeito econômico precisa de `idempotencyKey`.**
8. **Nenhum dado identificável de criança vai para o provedor de IA** — só `pseudonymId`.

---

## 8. Comandos

```bash
npm install
cp .env.example .env          # preencher DATABASE_URL e AUTH_SECRET
npx prisma generate
npm run dev                   # http://localhost:3000

npm run verify                # tipos + lint + fronteiras + testes — o que o CI roda
npm run build                 # build de produção
npx prisma migrate dev        # depois que houver banco
```

---

## 9. Armadilhas conhecidas

- `npm run boundaries` emite **warnings** de "órfão" para os arquivos de token.
  É esperado: eles ainda só são consumidos por testes e por CSS. Sai sozinho quando
  os componentes do Design System existirem. Warnings não quebram o build; erros sim.
- `prisma format` reordena o arquivo. Rode antes de commitar para evitar diff sujo.
- O `package.json` tem `prisma.seed`, que o Prisma 7 vai depreciar. Quando migrar,
  mover para `prisma.config.ts`.
- A landing **não tem** botão de cadastro apontando para `/criar-conta` — foi removido
  de propósito, porque a rota não existe. Ao criar a rota, recoloque o CTA.

---

## 10. Ao terminar uma etapa

1. Rode `npm run verify` e o `npm run build`.
2. **Atualize este arquivo** — mova o que foi feito da seção 5 para a seção 3,
   e escreva a próxima tarefa. Um handoff desatualizado é pior que nenhum.
3. Commit com mensagem descritiva; push na branch de trabalho.
