# Crescendo e Aprendendo

Plataforma de desenvolvimento infantil gamificada — a criança vive uma aventura em mundos temáticos
e, ao jogar, desenvolve competências escolares (BNCC), cognitivas, socioemocionais, tecnológicas e
de vida. **6 a 12 anos na Fase 1, com arquitetura preparada para 17 anos sem reescrita.**

> **Status atual: planejamento concluído, aguardando aprovação.**
> Nenhum código de aplicação foi escrito ainda — por decisão explícita, a implementação começa
> após a aprovação deste planejamento. O roadmap de execução está em
> [`docs/12-roadmap.md`](docs/12-roadmap.md).

---

## Planejamento (leia nesta ordem)

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

## As seis Academias

| Academia | Foco |
|---|---|
| **Conhecimento** | conteúdo escolar alinhado à BNCC — Português, Matemática, Ciências, História, Geografia, Inglês, Espanhol |
| **Inteligência** | memória, atenção, lógica, estratégia, velocidade cognitiva — sudoku, xadrez, tangram, labirintos |
| **Vida** | finanças, comunicação, liderança, hábitos, saúde, segurança digital, uso responsável de IA |
| **Tecnologia** | programação, pensamento computacional, robótica, IA, cibersegurança, criação de jogos |
| **Criatividade** | desenho, música, escrita criativa, design, fotografia, invenções |
| **Descobertas** | projetos, experimentos, caça ao tesouro, missões em família, sustentabilidade |

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

Detalhamento em [`docs/00-visao-e-principios.md`](docs/00-visao-e-principios.md).

---

## Próximo passo

Revisar e aprovar o planejamento. Após a aprovação, a execução começa pela
**Etapa 0 — Fundação técnica** ([`docs/12-roadmap.md`](docs/12-roadmap.md)): repositório executável,
CI completo, autenticação de responsável e Design System base em produção.
