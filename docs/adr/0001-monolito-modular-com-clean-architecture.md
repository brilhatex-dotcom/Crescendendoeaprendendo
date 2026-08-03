# ADR 0001 — Monólito modular com Clean Architecture

- **Status:** Aceito
- **Data:** 2026-08-03
- **Contexto:** plataforma educacional gamificada, alvo de milhões de usuários, time pequeno no início.

## Decisão

Adotar um **monólito modular** em Next.js 15, com Clean Architecture (domain → application →
infrastructure/presentation) e fronteiras entre módulos verificadas automaticamente em CI
(`dependency-cruiser` + `eslint-plugin-boundaries`), comunicando-se por eventos de domínio com
outbox transacional.

## Alternativas consideradas

1. **Microsserviços desde o início** — rejeitado: as operações mais frequentes (tentativa → domínio →
   XP → moeda → conquista) exigem consistência transacional. Distribuir isso compraria consistência
   eventual, latência e complexidade operacional sem benefício de escala real nesta fase.
2. **Next.js "padrão" sem camadas** (lógica em Server Actions e componentes) — rejeitado: em 12–18
   meses a regra de negócio ficaria espalhada entre UI e acesso a dados, tornando impossível testar
   o domínio isoladamente e inviabilizando a evolução de currículo/economia sem regressão.

## Consequências

- **Positivas:** domínio testável sem banco; troca de infraestrutura por adaptador; extração futura
  de um módulo vira substituição de adaptador; onboarding previsível (toda pasta tem a mesma forma).
- **Custo aceito:** mais arquivos e uma indireção a mais entre rota e banco; exige disciplina de
  fronteira — mitigada por verificação automática que quebra o build.
