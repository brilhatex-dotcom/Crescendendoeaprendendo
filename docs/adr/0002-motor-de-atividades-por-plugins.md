# ADR 0002 — Motor de atividades baseado em plugins tipados

- **Status:** Aceito
- **Data:** 2026-08-03

## Contexto

A plataforma prevê dezenas de tipos de interação (múltipla escolha, sudoku, xadrez, blocos de
código, desenho, gravação de voz, construção). Se cada tipo tocar o schema do banco, o motor de
sessão e as telas, o sistema se torna imutável na prática após ~10 tipos.

## Decisão

Todo tipo de atividade é um **plugin** que declara exatamente quatro coisas: `configSchema` (Zod),
`answerSchema` (Zod), `evaluate` (função **pura**) e `renderer` (client component carregado sob
demanda). O registro (`activities/registry.ts`) resolve tipo → plugin. O conteúdo é armazenado como
`Activity.config: Json` com `schemaVersion`, validado na autoria e na leitura.

## Consequências

- **Positivas:** novo minigame = uma pasta + conteúdo, sem migration e sem alterar o motor
  (Open/Closed); `evaluate` puro roda no servidor (autoritativo) e no cliente (offline e feedback
  otimista) com **o mesmo código**, eliminando duplicação de regra de correção; teste unitário de
  correção não precisa de banco nem de navegador; bundle cresce por rota, não globalmente.
- **Custo aceito:** `config` em JSON não tem integridade referencial garantida pelo Postgres — o
  contrato passa a ser garantido pelo Zod na escrita, na publicação e na leitura, com validação de
  todo o acervo em CI (`scripts/validate-content.ts`).
- **Risco mitigado:** evolução de formato exige `schemaVersion` + migração de conteúdo versionada,
  nunca leitura tolerante a "qualquer formato".
