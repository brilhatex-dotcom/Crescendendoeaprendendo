# 02 — Estrutura de Pastas

Monorepo simples (um app Next.js + pacotes internos por workspace do npm). Não usamos Turborepo na
Fase 1 — um app, um pipeline, KISS. A estrutura já está pronta para virar monorepo real quando
existir um segundo consumidor (app nativo, CMS separado).

```
crescendo-e-aprendendo/
├── app/                              # App Router — APENAS roteamento e composição de UI
│   ├── (marketing)/                  # público, estático/ISR, SEO
│   │   ├── page.tsx                  # landing
│   │   ├── para-pais/page.tsx
│   │   ├── para-escolas/page.tsx
│   │   ├── privacidade/page.tsx
│   │   └── layout.tsx
│   ├── (auth)/                       # fluxos de conta adulta
│   │   ├── entrar/page.tsx
│   │   ├── criar-conta/page.tsx
│   │   ├── recuperar/page.tsx
│   │   ├── verificar-email/page.tsx
│   │   └── layout.tsx
│   ├── (guardian)/                   # área do responsável — exige sessão adulta
│   │   ├── familia/page.tsx          # seletor de perfis
│   │   ├── familia/criancas/[learnerId]/…
│   │   ├── painel/…                  # relatórios, metas, controles
│   │   └── layout.tsx
│   ├── (teacher)/                    # área do professor
│   │   ├── turmas/…
│   │   ├── atividades/…
│   │   └── layout.tsx
│   ├── (play)/                       # EXPERIÊNCIA DA CRIANÇA — sessão de criança
│   │   ├── hub/page.tsx              # casa/base, mascote, resumo do dia
│   │   ├── academias/page.tsx        # seleção de academia (mapa-mãe)
│   │   ├── academias/[academy]/page.tsx        # mundo + mapa
│   │   ├── academias/[academy]/[world]/page.tsx
│   │   ├── missao/[questId]/page.tsx           # sessão de gameplay (fullscreen)
│   │   ├── missao/[questId]/resultado/page.tsx
│   │   ├── tutor/page.tsx
│   │   ├── colecoes/…                # conquistas, medalhas, itens, veículos
│   │   ├── loja/page.tsx
│   │   ├── casa/page.tsx             # customização
│   │   └── layout.tsx                # HUD persistente (XP, energia, moedas)
│   ├── (admin)/                      # backoffice interno
│   │   ├── conteudo/…                # curadoria, packs, revisão pedagógica
│   │   ├── flags/page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── jobs/[job]/route.ts       # consumidores de fila (HMAC)
│   │   ├── uploads/sign/route.ts
│   │   ├── tutor/stream/route.ts     # streaming de tokens
│   │   └── health/route.ts
│   ├── manifest.webmanifest/route.ts
│   ├── sitemap.ts · robots.ts · opengraph-image.tsx
│   ├── global-error.tsx · not-found.tsx
│   └── layout.tsx                    # providers, fontes, tema, i18n
│
├── src/
│   ├── modules/                      # BOUNDED CONTEXTS (ver 01 §2)
│   │   └── <modulo>/                 # ex.: assessment
│   │       ├── domain/               # entidades, VOs, eventos, serviços de domínio (TS puro)
│   │       ├── application/          # use cases, ports, DTOs, policies
│   │       ├── infrastructure/       # repositórios Prisma, adaptadores
│   │       ├── presentation/         # server actions, componentes específicos do módulo
│   │       └── index.ts              # API pública do módulo (o único import permitido de fora)
│   │
│   ├── activities/                   # MOTOR DE ATIVIDADES (plugins)
│   │   ├── registry.ts               # mapa type → plugin (Open/Closed)
│   │   ├── contracts.ts              # ActivityPlugin, EvaluationResult, contextos
│   │   └── plugins/
│   │       ├── multiple-choice/{schema.ts,evaluate.ts,Renderer.tsx,index.ts,evaluate.test.ts}
│   │       ├── grid-puzzle/…
│   │       └── …                     # um diretório por tipo, mesma forma sempre
│   │
│   ├── design-system/                # DS (ver 05) — sem regra de negócio
│   │   ├── tokens/{color,typography,space,motion,elevation,radius}.ts
│   │   ├── primitives/               # Button, Card, Dialog, Input, Sheet… (shadcn como base)
│   │   ├── game/                     # XPBar, EnergyMeter, CoinCounter, MapNode, QuestCard, Mascot…
│   │   ├── motion/                   # variants Framer Motion reutilizáveis
│   │   └── index.ts
│   │
│   ├── shared/
│   │   ├── kernel/                   # Result, Entity, ValueObject, DomainEvent, Clock, Id
│   │   ├── errors/                   # AppError e taxonomia
│   │   ├── validation/               # helpers Zod, schemas comuns
│   │   ├── security/                 # csp, sanitização, hashing, assinatura
│   │   ├── observability/            # logger, tracing, métricas
│   │   ├── i18n/                     # dicionários e resolução de locale
│   │   └── utils/
│   │
│   ├── composition/                  # composition root (fábricas por módulo)
│   ├── server/
│   │   ├── db.ts                     # PrismaClient singleton (pooled)
│   │   ├── cache.ts                  # Redis + tags de cache
│   │   ├── queue.ts                  # publicação/consumo de jobs
│   │   ├── blob.ts · mailer.ts · ai/ # adaptadores externos
│   │   └── action.ts                 # createAction(): auth + zod + rate limit + audit + erros
│   └── config/                       # env (validado por Zod), constantes, feature flags
│
├── content/                          # CONTEÚDO COMO DADO (versionado em git)
│   ├── curriculum/                   # competências BNCC e não-BNCC (YAML/JSON)
│   ├── packs/                        # pacotes de atividades por mundo/capítulo
│   ├── narrative/                    # personagens, diálogos, roteiros
│   └── schema/                       # schemas Zod de autoria + validador de CI
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/                         # seeds determinísticos (dev, preview, demo)
│
├── public/
│   ├── icons/ (PWA) · splash/ · sfx/ · sprites/ · lottie/
│   └── sw.js gerado no build (Serwist)
│
├── tests/
│   ├── e2e/                          # Playwright (jornadas de 03 §6)
│   ├── integration/
│   ├── policy/                       # testes das proibições de 00 §P2
│   └── fixtures/
│
├── docs/                             # este planejamento + ADRs
├── scripts/                          # validação de conteúdo, geração de ícones, checks
└── .github/workflows/                # ci.yml, lighthouse.yml, content-validate.yml
```

## Regras de organização

1. **`app/` é fino.** Um arquivo de rota faz: buscar dados via use case, compor componentes, definir
   metadata. Se tiver `if` de regra de negócio, está no lugar errado.
2. **Fronteira do módulo é o `index.ts`.** Import de `@/modules/x/domain/...` a partir de outro
   módulo é erro de lint. Só `@/modules/x` é público.
3. **Um plugin de atividade, uma pasta, sempre a mesma forma.** Previsibilidade > criatividade
   estrutural.
4. **Design System não importa `modules/`.** Nunca. Ele recebe props.
5. **Colocation de teste:** teste unitário mora ao lado do arquivo; integração e E2E em `tests/`.
6. **Aliases:** `@/modules`, `@/design-system`, `@/shared`, `@/server`, `@/activities`, `@/content`.
