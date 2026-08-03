# Crescendo e Aprendendo

Plataforma de desenvolvimento infantil gamificada — a criança vive uma aventura em mundos temáticos
e, ao jogar, desenvolve competências escolares (BNCC), cognitivas, socioemocionais, tecnológicas e
de vida. **6 a 12 anos na Fase 1, com arquitetura preparada para 17 anos sem reescrita.**

> 🔀 **Vai continuar o trabalho em outra sessão? Comece por [`docs/HANDOFF.md`](docs/HANDOFF.md).**
> Ele diz o que já existe, o que não existe, qual é a próxima tarefa e o que não deve ser
> relitigado.

> **Status atual: Etapa 0 (Fundação técnica) em construção.**
> A Bíblia Pedagógica (Volume 1) e o planejamento técnico estão concluídos. O roadmap de produto
> está no [Capítulo 12 da Bíblia](docs/biblia/volume-1/12-roadmap-5-anos.md) e o de execução
> técnica em [`docs/12-roadmap.md`](docs/12-roadmap.md).

## Rodando o projeto

```bash
npm install
cp .env.example .env      # preencha DATABASE_URL e AUTH_SECRET
npx prisma generate
npm run dev               # http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `npm run verify` | tipos + lint + fronteiras de arquitetura + testes (o que o CI roda) |
| `npm run typecheck` | TypeScript `strict`, zero `any` |
| `npm run boundaries` | verifica as fronteiras entre camadas — violação quebra o build |
| `npm run test` | testes unitários e **testes de política** (as proibições da Bíblia) |
| `npm run db:migrate` | aplica migrations no banco de desenvolvimento |
| `npm run build` | build de produção |

**Orçamento de performance:** o JS inicial da rota `/hub` não pode passar de 140 kB gzip
([`docs/10 §5`](docs/10-escalabilidade-e-performance.md)).

---

## 📖 Bíblia Pedagógica — a Constituição do projeto

**[`docs/biblia/`](docs/biblia/README.md)** é o documento de maior autoridade deste repositório.
Código, design, conteúdo, IA, banco de dados e marketing derivam dela, e **nada pode contradizê-la**.

| Cap. | Volume 1 | |
|---|---|---|
| — | [Preâmbulo](docs/biblia/volume-1/00-preambulo.md) | estatuto e processo de emenda |
| 1 | [Fundamentos](docs/biblia/volume-1/01-fundamentos.md) | missão, valores, princípios |
| 2 | [Público](docs/biblia/volume-1/02-publico.md) | crianças, pais, escolas, professores |
| 3 | [O Universo](docs/biblia/volume-1/03-universo.md) | **Crescente** |
| 4 | [As Sete Academias](docs/biblia/volume-1/04-as-sete-academias.md) | o que ensinamos |
| 5 | [Prosperidade](docs/biblia/volume-1/05-academia-da-prosperidade.md) | nosso maior diferencial |
| 6 | [Sistema de Evolução](docs/biblia/volume-1/06-sistema-de-evolucao.md) | Luz, níveis, economia |
| 7 | [Personagens](docs/biblia/volume-1/07-personagens.md) | o elenco |
| 8 | [Inteligência Artificial](docs/biblia/volume-1/08-inteligencia-artificial.md) | o contrato do Tutor |
| 9 | [Pais](docs/biblia/volume-1/09-pais.md) | o contrato com a família |
| 10 | [Professores](docs/biblia/volume-1/10-professores.md) | o compromisso docente |
| 11 | [Identidade Visual](docs/biblia/volume-1/11-identidade-visual.md) | como o mundo se parece e soa |
| 12 | [Roadmap de 5 anos](docs/biblia/volume-1/12-roadmap-5-anos.md) | onde chegaremos |

---

## Planejamento técnico (leia nesta ordem)

| # | Documento | O que responde |
|---|---|---|
| 00 | [Visão e princípios](docs/00-visao-e-principios.md) | o que é o produto, para quem, e as 5 regras inegociáveis |
| 01 | [Arquitetura do sistema](docs/01-arquitetura.md) | camadas, módulos, eventos, motor de atividades, renderização |
| 02 | [Estrutura de pastas](docs/02-estrutura-de-pastas.md) | onde cada coisa mora e por quê |
| 03 | [Fluxogramas](docs/03-fluxos.md) | onboarding, loop de aprendizagem, adaptatividade, tutor, offline |
| 04 | [Modelagem de dados](docs/04-modelagem-de-dados.md) | schema Prisma completo, índices, particionamento, seeds |
| 05 | [Design System "Aurora"](docs/05-design-system.md) | tokens, cor, tipografia, movimento, acessibilidade |
| 06 | [Mapa de páginas](docs/06-paginas.md) | todas as rotas, por público e estratégia de renderização |
| 07 | [Componentes reutilizáveis](docs/07-componentes.md) | contratos, hooks, máquina de estados da sessão |
| 08 | [Regras de negócio](docs/08-regras-de-negocio.md) | XP, níveis, domínio, energia, economia, tutor, talentos |
| 09 | [Autenticação e segurança](docs/09-autenticacao-e-seguranca.md) | sessões, RBAC, controles de segurança, LGPD |
| 10 | [Escalabilidade e performance](docs/10-escalabilidade-e-performance.md) | carga, cache, banco, orçamentos, custo de IA |
| 11 | [PWA e offline](docs/11-pwa.md) | service worker, manifest, sincronização, instalação |
| 12 | [Roadmap](docs/12-roadmap.md) | etapas, critérios de aceite, riscos |

Decisões arquiteturais: [`docs/adr/`](docs/adr/)

---

## Stack

**Next.js 15 (App Router)** · TypeScript · Tailwind CSS · shadcn/ui · Framer Motion · Lucide ·
**Neon PostgreSQL** · Prisma · Auth.js · React Hook Form + Zod · Vercel + Vercel Blob ·
Server Actions + React Server Components · PWA (Serwist).

---

## As sete Academias

Sete ilhas do arquipélago de **Crescente**, cada uma com seu Farol, seu guardião e sua forma de
perguntar ([Bíblia, Cap. 4](docs/biblia/volume-1/04-as-sete-academias.md)).

| Academia | Ilha · Guardião | Foco |
|---|---|---|
| **Conhecimento** | Mil Perguntas · ORLA | conteúdo escolar alinhado à BNCC — Português, Matemática, Ciências, História, Geografia, Inglês, Espanhol |
| **Inteligência** | dos Nós · TRAMA | memória, atenção, lógica, estratégia, velocidade cognitiva — sudoku, xadrez, tangram, labirintos |
| **Vida** | do Vilarejo · DONA JUÁ | socioemocional, hábitos, saúde, comunicação, segurança digital, uso responsável de IA |
| **Tecnologia** | Engrena · PARAFUSA | programação, pensamento computacional, robótica, IA, cibersegurança, criação de jogos |
| **Criatividade** | Aquarela · ÍRIS | desenho, música, escrita criativa, design, fotografia, invenções |
| **Descobertas** | Errante · VENTANIA | projetos, experimentos, caça ao tesouro, missões em família, sustentabilidade |
| **Prosperidade** | Pontal · DONA CASTANHA | educação financeira, empreendedorismo, planejamento, consumo consciente, gestão, ética — em ambiente 100% simulado ([Cap. 5](docs/biblia/volume-1/05-academia-da-prosperidade.md)) |

---

## Os cinco princípios que governam todas as decisões

1. **Aprender é a recompensa**, não o pedágio para chegar à diversão.
2. **Zero mecânicas predatórias** — sem loot box paga, sem pay-to-win, sem ranking global, sem
   notificação de culpa. Proibições verificadas por testes automatizados em CI.
3. **A criança nunca é rotulada** — o perfil de talentos sugere, jamais restringe.
4. **Erro é matéria-prima** — nenhuma resposta é apenas "errado"; o tipo `EvaluationResult` não
   compila sem feedback pedagógico.
5. **Privacidade infantil acima de conveniência** — criança não tem e-mail, chat livre, perfil
   público nem push. LGPD por construção.

Detalhamento em [`docs/00-visao-e-principios.md`](docs/00-visao-e-principios.md) e, com força
constitucional, no [Capítulo 1 da Bíblia](docs/biblia/volume-1/01-fundamentos.md).

---

## Próximo passo

1. **Aprovar o Volume 1 da Bíblia Pedagógica** — é o que trava todo o resto.
2. Aprovado o Volume 1, escrever o **Volume 2** (currículo BNCC detalhado, progressões e taxonomia
   de equívocos), que é o insumo direto da produção de conteúdo.
3. Iniciar a **Etapa 0 — Fundação técnica** ([`docs/12-roadmap.md`](docs/12-roadmap.md)):
   repositório executável, CI completo, autenticação de responsável e Design System base em produção.
