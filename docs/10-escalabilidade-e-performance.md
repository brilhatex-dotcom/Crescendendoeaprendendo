# 10 — Escalabilidade, Performance e Custo

## 1. Perfil de carga esperado

Modelo dimensionado para **1 milhão de crianças ativas por mês / 150 mil por dia**, com pico
concentrado (17h–21h no fuso local, mais forte de segunda a quinta).

| Métrica | Estimativa | Implicação |
|---|---|---|
| Sessões/dia | ~300 mil | pico ~40 req/s de leitura de mapa/hub |
| Tentativas/dia | ~9 milhões (30/sessão) | ~1.500 escritas/s no pico → **é o gargalo real** |
| Eventos de telemetria/dia | ~30 milhões | fora do caminho crítico, em lote |
| Tutor IA | ~5% das sessões | custo, não throughput |

Conclusão de projeto: **a escrita de tentativa é o caminho quente**. Todo o resto é cache.

## 2. Estratégia por camada

| Camada | Técnica |
|---|---|
| Borda | CDN da Vercel para estáticos e páginas de marketing; middleware leve (< 5ms) |
| Conteúdo (global, imutável por versão) | `unstable_cache` com tags `content:v{n}`, `world:{id}`, `pack:{id}`; invalidação por publicação, não por tempo |
| Dados do jogador | sem cache HTTP; leitura direta indexada + Redis para o "cartão do jogador" (nível, XP, moedas, energia), TTL 60s, invalidado por evento |
| Sessão de jogo | pré-carregada inteira ao iniciar a missão (1 round-trip); respostas seguem por Server Action leve |
| Escrita | transação curta (< 15ms alvo), somente as 7 tabelas de `08 §11`; o resto vai por outbox |
| Relatórios | snapshots materializados por job noturno; nunca varredura de `Attempt` em request |
| Telemetria | buffer no cliente → envio em lote (`sendBeacon`) → fila → inserção em lote a cada 5s |

## 3. Consultas críticas (cada índice de `04` tem uma dona)

| # | Consulta | Alvo p95 | Suporte |
|---|---|---|---|
| Q1 | Hub da criança (progresso, energia, missão do dia) | 40ms | `LearnerProgress` PK + cache Redis |
| Q2 | Mapa do mundo + estado de cada nó | 80ms | conteúdo em cache + 1 query de `QuestRun` por `learnerId` |
| Q3 | Iniciar missão (etapas + atividades + slots resolvidos) | 120ms | `Stage`/`StageActivity` em cache; seleção adaptativa usa `SkillMastery` do learner |
| Q4 | Submeter tentativa (transação completa) | 90ms | índices de `Attempt`, `SkillMastery` PK composta |
| Q5 | Painel semanal do responsável | 200ms (streaming) | `LearnerWeeklySnapshot` |
| Q6 | Turma do professor (30 alunos) | 300ms | agregado por turma materializado |
| Q7 | Fila de revisão do dia | 30ms | `ReviewCard(learnerId, dueAt)` |

Toda query nova entra nesta tabela com seu orçamento; PR que introduz consulta sem orçamento é
recusado. `EXPLAIN ANALYZE` obrigatório para consulta em tabela particionada.

## 4. Banco de dados

- **Neon** com autoscaling de compute e *scale-to-zero* em ambientes não produtivos.
- **Réplica de leitura** para painéis, relatórios e admin (rota `readOnly` do Prisma) — separa carga
  analítica da transacional.
- **Pooling**: string pooled (PgBouncer, modo transaction) para o app; `connection_limit=1..3` por
  instância serverless — a soma de conexões é o que derruba Postgres em serverless.
- **Particionamento** mensal das tabelas append-only (`04 §12`), com job de criação antecipada e
  *detach* + arquivamento em objeto frio após a janela de retenção.
- **Sem trigger de negócio no banco.** Regra fica no domínio; banco garante integridade
  (FK, `CHECK`, `UNIQUE`) e nada mais.
- Migrations: `prisma migrate deploy` em passo dedicado, sempre compatível para frente
  (expand → migrate → contract), permitindo deploy sem downtime.

## 5. Orçamento de performance no cliente (Lighthouse ≥ 95)

| Métrica | Orçamento |
|---|---|
| LCP (móvel 4G, hub) | ≤ 1.8s |
| INP | ≤ 150ms |
| CLS | ≤ 0.05 |
| TBT | ≤ 150ms |
| JS inicial (rota `/hub`) | ≤ 140 kB gzip |
| JS por renderer de atividade | ≤ 30 kB gzip |
| Imagem acima da dobra | AVIF/WebP, `priority`, dimensões fixas |

Como é sustentado:
1. **RSC por padrão** — o cliente só recebe JS de ilhas interativas.
2. **`next/dynamic`** para cada renderer de atividade, mascote 3D, gráficos e editor.
3. **`next/font`** self-hosted com subset; zero FOUT.
4. **Sprites atlas + Lottie otimizado**; nenhuma animação em GIF.
5. **Streaming com Suspense**: HUD e mapa aparecem antes dos dados pesados.
6. `bundle-analyzer` + Lighthouse CI em cada PR, com limites que **falham o build**.
7. Pré-carregamento inteligente: ao abrir o mapa, `prefetch` das 2 missões mais prováveis.
8. Web Worker para geração/validação de puzzles pesados (sudoku, labirinto).

## 6. Custo (a variável que mata produtos de IA)

| Fonte | Controle |
|---|---|
| LLM | orçamento por criança/dia; roteamento por complexidade (modelo pequeno para dica curta, grande para explicação); cache semântico de explicações por (competência, equívoco, faixa etária) — a mesma dúvida não é gerada duas vezes; geração **em lote e antecipada** de conteúdo, fora do horário de pico |
| Banco | scale-to-zero em preview; snapshots reduzem varredura; retenção agressiva de telemetria |
| Blob/CDN | mídia versionada e imutável, cache longo; imagens geradas em build |
| Funções | evitar RSC dinâmico onde ISR resolve; middleware enxuto |

Meta: **custo marginal de IA por criança ativa/mês abaixo do preço de 3% do plano familiar** —
medido por métrica em produção, com alerta de desvio.

## 7. Como o sistema cresce sem reescrita

| Vetor de crescimento | O que muda | O que **não** muda |
|---|---|---|
| Faixa etária até 17 anos | conteúdo, tema `PIONEER`/`VANGUARD`, copy | schema, motor, economia, auth |
| Novo minigame | 1 pasta de plugin + conteúdo | motor de sessão, banco |
| Nova academia | linhas em `Academy`/`World` + pacote de conteúdo | código |
| Novo idioma | dicionários + `locale` no conteúdo | rotas, domínio |
| Escolas grandes / redes | `Organization` já modelada, réplica de leitura | modelo de dados |
| 10× de tráfego | mais compute Neon, mais réplicas, particionamento já pronto | arquitetura |
| Extrair um módulo | trocar adaptador do módulo por cliente HTTP | domínio e casos de uso |

## 8. Confiabilidade

- **SLO**: 99.9% de disponibilidade mensal; p95 de `submitAttempt` < 300ms fim a fim.
- **Degradação graciosa**: sem Redis → cai para banco; sem IA → conteúdo curado; sem fila → outbox
  acumula e drena; sem rede → PWA offline. Nenhuma falha de dependência secundária impede jogar.
- **Backup**: PITR do Neon (7 dias em prod), *restore drill* trimestral documentado.
- **Deploy**: preview por PR com banco efêmero; produção com feature flags e rollout progressivo;
  rollback é reverter o deploy (migrations sempre compatíveis para frente).
- **Testes de carga** antes de cada marco: k6 simulando pico de 2× com seed `seed:load`.
