# 12 — Roadmap de Implementação

Cada etapa termina com software **funcionando, testado e implantado** — nada de "fundação sem tela".
Nenhuma etapa deixa código provisório para a seguinte. Estimativas em semanas de um time de 4–6
pessoas (2 full stack, 1 design/UX, 1 conteúdo/pedagogia, apoio de QA).

---

## Etapa 0 — Fundação técnica (1–2 semanas)

**Entrega:** repositório executável, com pipeline verde e uma página real em produção.

- Next.js 15 + TypeScript `strict`, Tailwind, shadcn, Framer Motion, Lucide.
- Prisma + Neon (branches por ambiente), `.env` validado por Zod.
- Auth.js configurado (login adulto + verificação de e-mail).
- CI: lint, tipos, testes, dependency-cruiser, Lighthouse CI, validação de conteúdo.
- Deploy Vercel + preview por PR com banco efêmero e seed.
- Tokens do Design System + Storybook + 8 primitivos.
- Observabilidade: logger estruturado, tracing, health check.

**Aceite:** `/` e `/entrar` em produção; criar conta e verificar e-mail funcionam; CI bloqueia PR ruim.

---

## Etapa 1 — Espinha dorsal jogável (3–4 semanas)

**Entrega:** uma criança consegue jogar uma missão de verdade, do login ao resultado.

- Modelos `Learner`, `GuardianLink`, `Consent`, sub-sessão de criança, seletor de perfis.
- Motor de atividades + 4 plugins: `MULTIPLE_CHOICE`, `DRAG_MATCH`, `ORDER_SEQUENCE`, `FILL_BLANK`.
- `Quest`/`Stage`/`QuestRun`, máquina de estados da sessão, `submitAttempt` transacional + outbox.
- Progressão (XP, nível, energia) e economia (moedas + razão contábil).
- HUD, mapa de mundo simples, tela de resultado com recompensas.
- Conteúdo: 1 mundo da Academia do Conhecimento (Matemática, 3 capítulos, ~60 atividades).

**Aceite:** jornadas E2E 1, 3, 4 e 5 de `03 §6` passam; p95 de `submitAttempt` < 300ms.

---

## Etapa 2 — Aprendizagem de verdade (3 semanas)

- Currículo BNCC (Português e Matemática, 1º–5º ano) com DAG de pré-requisitos.
- BKT + Elo, `SkillMastery`, seleção adaptativa com slots dinâmicos.
- Revisão espaçada (`ReviewCard`) e fila diária.
- Sondagem de nivelamento no onboarding.
- Chefões com exigência de domínio; regras declarativas de desbloqueio.
- Calibração automática de dificuldade (job noturno).

**Aceite:** curva de acerto real entre 75% e 85%; domínio previsto valida contra desempenho posterior
em teste de retenção interno; jornada 6 passa.

---

## Etapa 3 — Responsável e confiança (2–3 semanas)

- Painel dos pais: visão semanal, relatórios por competência com evidências, snapshots materializados.
- Controles: limite de tempo, janelas, academias, PIN, auditoria.
- LGPD completo: exportação, exclusão, revogação, página de privacidade versionada.
- Notificações para adultos (e-mail + push) com preferências.

**Aceite:** jornadas 9 e 10 passam; auditoria de segurança interna sem achado alto.

---

## Etapa 4 — PWA e desempenho (1–2 semanas)

- Serwist, manifest, ícones/splash gerados, offline com fila e reconciliação.
- Orçamentos de performance aplicados no CI; Lighthouse ≥ 95 nas 4 rotas principais.
- Auditoria de acessibilidade AA com correções.

**Aceite:** jornada 12 passa em Android e iOS; Lighthouse ≥ 95; zero violação axe séria.

---

## Etapa 5 — Academia da Inteligência (2–3 semanas)

- Plugins `GRID_PUZZLE` (sudoku, labirinto, tangram), `MEMORY_PAIRS`, `SPEED_TAP`, `STORY_BRANCH`.
- Mundo próprio, medalhas cognitivas, desafios diários.
- Modo acessível alternativo documentado para cada minigame.

---

## Etapa 6 — Tutor IA (3 semanas)

- Sessões de tutoria com streaming, guardas de entrada/saída, orçamento de custo, cache semântico.
- Diagnóstico de equívoco e dica escalonada integrados ao motor.
- Geração de micro-desafios validada por schema + revisão amostral.
- Transcrições visíveis ao responsável; sinalização de risco.
- Perfil de talentos com teto de recomendação.

**Aceite:** 0 vazamento de PII para o provedor (verificado por teste); taxa de conteúdo gerado
reprovado < 5%; custo por criança/mês dentro da meta de `10 §6`.

---

## Etapa 7 — Expansão curricular (4–6 semanas)

Ciências, História, Geografia, Inglês; Academia da Vida (Educação Financeira, Segurança Digital,
Hábitos, Comunicação como primeiros módulos). Conteúdo em ritmo contínuo a partir daqui.

---

## Etapa 8 — Escolas (4 semanas)

`Organization`, turmas, códigos de entrada, atribuições, correção, cobertura BNCC, ranking saudável,
sugestões de plano de aula por IA, SSO escolar, réplica de leitura para relatórios.

---

## Etapa 9 — Criação e comunidade moderada (5+ semanas)

Academia da Tecnologia (`CODE_BLOCKS`), Criatividade (`DRAWING_CANVAS`, `AUDIO_RECORD`),
Descobertas (`PHOTO_PROOF`, projetos em família), CMS de conteúdo, moderação humana + automática.

---

## Etapa 10 — Ampliação etária (contínuo)

Temas e conteúdo `PIONEER` (13–15) e `VANGUARD` (16–17), trilhas de projeto e portfólio.
Sem alteração de arquitetura — apenas conteúdo, tema e copy (`10 §7`).

---

## Critérios de "pronto" (aplicáveis a toda etapa)

1. Testes unitários, de integração e E2E das jornadas afetadas, verdes.
2. Acessibilidade AA verificada (axe + teclado + leitor de tela).
3. Orçamento de performance respeitado.
4. Sem `TODO`, sem código morto, sem duplicação detectada.
5. Documentação atualizada + ADR quando houver decisão arquitetural.
6. Feature flag para tudo que ainda não é definitivo.
7. Revisão pedagógica assinada para todo conteúdo novo.
8. Revisão de segurança para mudanças em auth, política, IA ou pagamento.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Produção de conteúdo é o gargalo real (não o código) | pipeline de autoria desde a Etapa 2, CMS na Etapa 9, geração assistida por IA com revisão humana |
| Custo de IA fugir do controle | orçamento por criança, cache semântico, roteamento de modelo, alerta desde o dia 1 |
| Escopo das 6 academias diluir a qualidade | uma academia excelente vale mais que seis medianas — só abrir nova academia com a anterior no padrão de aceite |
| Gamificação virar mecânica predatória por pressão de métrica | testes de política em CI (`08 §12`) + métrica-norte de domínio, não de tempo de tela |
| Adaptatividade errar e frustrar | limites de segurança (recuo após 3 erros), monitoramento da curva de acerto, sempre encerrar sessão com sucesso |
