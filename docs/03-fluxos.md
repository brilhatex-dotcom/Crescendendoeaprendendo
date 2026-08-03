# 03 — Fluxogramas das Funcionalidades

## 1. Mapa de alto nível do produto

```mermaid
flowchart TD
  A[Visitante] --> B{Tem conta?}
  B -- não --> C[Criar conta do responsável]
  C --> D[Verificar e-mail + Consentimento LGPD]
  D --> E[Criar perfil da criança<br/>apelido, idade, avatar, acessibilidade]
  B -- sim --> F[Entrar]
  E --> G[Seletor de perfis da família]
  F --> G
  G -->|escolhe criança + PIN| H[Sessão de criança]
  G -->|área adulta| I[Painel dos Pais]
  G -->|conta professor| J[Painel do Professor]
  H --> K[HUB — casa, mascote, missão do dia]
  K --> L[Academias]
  L --> M[Mundo + Mapa]
  M --> N[Missão]
  N --> O[Sessão de Jogo]
  O --> P[Resultado + Recompensas]
  P --> M
  K --> Q[Tutor IA] & R[Coleções] & S[Loja] & T[Casa]
```

## 2. Onboarding do responsável e da criança

```mermaid
flowchart TD
  S1[E-mail + senha ou Google] --> S2[Verificação de e-mail obrigatória]
  S2 --> S3[Termo de consentimento parental<br/>versão registrada + timestamp + IP]
  S3 --> S4[Criar perfil da criança]
  S4 --> S5{Idade}
  S5 -->|6-8| S6[AgeBand SPROUT<br/>áudio ligado por padrão]
  S5 -->|9-12| S7[AgeBand EXPLORER]
  S6 & S7 --> S8[Definir PIN de 4 dígitos do responsável]
  S8 --> S9[Sondagem lúdica de nivelamento<br/>6 a 8 atividades, sem nota, tema de aventura]
  S9 --> S10[Estimativa inicial de domínio por competência]
  S10 --> S11[Geração da trilha inicial + primeira missão]
  S11 --> S12[HUB com missão do dia pronta]
```

A sondagem **nunca** é apresentada como teste. É "a prova de entrada da Academia": narrativa,
sem pontuação exibida, adaptativa (para assim que a incerteza cai abaixo do limiar).

## 3. Loop principal de aprendizagem (o coração)

```mermaid
flowchart TD
  L1[HUB] --> L2[Selecionar missão no mapa]
  L2 --> L3{Pré-requisitos<br/>desbloqueados?}
  L3 -- não --> L4[Mostra caminho sugerido<br/>nunca só 'bloqueado']
  L3 -- sim --> L5[Abrir sessão · fullscreen]
  L5 --> L6[Intro narrativa curta ≤ 8s, pulável]
  L6 --> L7[Etapa: atividade renderizada pelo plugin]
  L7 --> L8[Criança responde]
  L8 --> L9[Feedback otimista imediato < 100ms]
  L9 --> L10[Server Action: submitAttempt · avaliação autoritativa]
  L10 --> L11{Correto?}
  L11 -- sim --> L12[Reforço visual + XP parcial]
  L11 -- não --> L13[Diagnóstico do equívoco]
  L13 --> L14[Dica escalonada 1 → 2 → ensinar e mostrar]
  L14 --> L15{Nova tentativa disponível?}
  L15 -- sim --> L7
  L15 -- não --> L16[Explicação completa + item de revisão agendado]
  L12 & L16 --> L17{Fim da etapa?}
  L17 -- não --> L7
  L17 -- sim --> L18[Tela de resultado: XP, moedas, domínio, coleção]
  L18 --> L19[Eventos → progressão, economia, conquistas, talentos, telemetria]
  L19 --> L20{Chefão do capítulo liberado?}
  L20 -- sim --> L21[Desafio de chefão: só competências já dominadas]
  L20 -- não --> L1
```

**Regra crítica (P4):** o caminho `L13 → L14` é obrigatório no tipo `EvaluationResult`. Não existe
ramo que devolva "errado" sem ensino.

## 4. Adaptatividade e revisão espaçada

```mermaid
flowchart LR
  A[Attempt avaliada] --> B[Atualiza SkillMastery<br/>BKT: P domínio]
  A --> C[Atualiza habilidade do jogador<br/>Elo por competência]
  B & C --> D{Domínio ≥ 0,85<br/>e ≥ 3 acertos?}
  D -- sim --> E[Competência dominada<br/>desbloqueia dependentes no DAG]
  D -- não --> F[Agenda revisão · SM-2 adaptado]
  F --> G[Fila de revisão do dia · máx. 20% da sessão]
  E --> H[Recalcula trilha recomendada]
  G --> H
  H --> I[Seleção da próxima atividade:<br/>dificuldade alvo = habilidade + 0,3σ<br/>zona de desenvolvimento proximal]
```

Seleção de dificuldade mira **~80% de acerto** — faixa de fluxo (Csikszentmihalyi) e de motivação
sustentada. Abaixo de 60% por 3 atividades, o sistema recua e injeta reforço; acima de 95% por 5,
avança e reduz repetição.

## 5. Fluxo do Tutor IA (com segurança)

```mermaid
flowchart TD
  T1[Criança pede ajuda ou erra 2x] --> T2[Monta contexto: competência, etapa,<br/>erro cometido, faixa etária, histórico curto]
  T2 --> T3[Sanitização: remove PII, aplica limites de token]
  T3 --> T4[Guarda de entrada: classificador de tópico e risco]
  T4 -->|fora de escopo ou risco| T5[Resposta segura pré-escrita<br/>+ sinaliza responsável se for risco]
  T4 -->|ok| T6[LLM com prompt de sistema pedagógico<br/>método socrático, nunca dá a resposta pronta]
  T6 --> T7[Guarda de saída: moderação, leiturabilidade,<br/>sem link, sem PII, sem promessa]
  T7 -->|reprovado| T5
  T7 --> T8[Streaming ao cliente]
  T8 --> T9[Registra turno · visível ao responsável]
  T9 --> T10{Detectou lacuna?}
  T10 -- sim --> T11[Gera micro-desafio personalizado<br/>validado pelo schema do plugin antes de exibir]
  T11 --> T12[Fila de conteúdo gerado · revisão amostral humana]
```

Conteúdo gerado por IA **só chega à criança se passar** pelo `configSchema` do plugin e pela
moderação. Geração inválida cai em fallback determinístico do banco curado.

## 6. Jornadas críticas cobertas por E2E

1. Criar conta → verificar e-mail → consentir → criar criança → entrar no hub.
2. Sondagem de nivelamento completa gera trilha.
3. Missão completa com 100% de acerto → recompensas creditadas exatamente uma vez.
4. Missão com erro → dica → acerto → item de revisão agendado.
5. Sessão interrompida (fechar aba) → retoma na mesma etapa, sem perder progresso.
6. Chefão bloqueado → caminho sugerido → chefão liberado após domínio.
7. Compra na loja → saldo debitado, item no inventário, razão contábil consistente.
8. Troca de perfil de criança exige PIN.
9. Responsável define limite de tempo → criança atinge limite → tela de pausa gentil.
10. Responsável exporta e exclui dados (LGPD).
11. Professor cria turma, atribui missão, vê conclusão.
12. Offline: entrar sem rede, jogar missão pré-carregada, sincronizar ao voltar.

## 7. Fluxo offline (PWA)

```mermaid
flowchart TD
  O1[Instalação/primeiro uso] --> O2[Pré-cache: shell, DS, ícones, sons base]
  O2 --> O3[Pré-carrega próximas 3 missões da trilha + assets]
  O3 --> O4{Online?}
  O4 -- sim --> O5[Fluxo normal · submissão direta]
  O4 -- não --> O6[Jogo roda com evaluate local do plugin]
  O6 --> O7[Fila de tentativas em IndexedDB<br/>com idempotencyKey]
  O7 --> O8[Ao reconectar: sync em lote]
  O8 --> O9[Servidor reavalia com a MESMA função pura]
  O9 --> O10{Divergência?}
  O10 -- sim --> O11[Servidor vence · ajusta saldo · registra em auditoria]
  O10 -- não --> O12[Confirma recompensas]
```

Recompensas offline são **provisórias e marcadas** na UI ("sincronizando"), evitando tanto frustração
quanto exploit.

## 8. Fluxo do responsável (controle e visão)

```mermaid
flowchart TD
  G1[Painel] --> G2[Visão da semana: tempo, domínio, humor, sequência]
  G1 --> G3[Relatório por competência com evidências]
  G1 --> G4[Controles: janelas de horário, limite diário,<br/>academias liberadas, tutor IA on/off]
  G1 --> G5[Metas em família · missões conjuntas]
  G1 --> G6[Privacidade: exportar, excluir, revogar consentimento]
  G4 --> G7[Alterações exigem PIN · gravadas em auditoria]
  G2 --> G8[Sugestões da IA em linguagem de apoio,<br/>nunca comparativa entre crianças]
```
