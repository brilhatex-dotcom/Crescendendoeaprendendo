# 08 — Regras de Negócio

Toda regra aqui é **determinística, testável e implementada no domínio** (não na UI, não no banco,
não espalhada em Server Actions). Constantes de balanceamento ficam em `content/` versionado, para
ajuste sem deploy de código.

## 1. Experiência (XP) e níveis

**Fonte de XP**
| Origem | XP |
|---|---|
| Atividade correta na 1ª tentativa | `10 × difficultyFactor` |
| Atividade correta após dica | `6 × difficultyFactor` |
| Atividade correta após ensino | `4 × difficultyFactor` (nunca zero — errar e aprender rende) |
| Missão concluída | `Quest.rewardXp` |
| Chefão vencido | `Quest.rewardXp × 1.5` |
| Item de revisão em dia | `5` |
| Primeira sessão do dia | `+20` (bônus de retomada, não de permanência) |

`difficultyFactor = clamp(0.6, 1.8, 1 + (activity.difficulty − learner.ability) / 400)`.
Efeito: repetir conteúdo fácil rende quase nada; encarar o desafio certo rende muito. Isso remove o
incentivo a farmar e alinha diversão com aprendizagem (P1).

**Curva de nível:** `xpParaNivel(n) = round(120 × n^1.45)`. Progressão rápida nos níveis 1–10
(engajamento inicial), estável depois. Tiers:

| Tier | Níveis | Desbloqueia |
|---|---|---|
| Aprendiz | 1–9 | Academia do Conhecimento, mascote |
| Explorador | 10–19 | Academia da Inteligência (10) e da Prosperidade (15), veículo 1, casa |
| Inventor | 20–34 | Academia da Tecnologia, oficina |
| Guardião | 35–49 | Academia da Vida, missões em família |
| Mestre | 50–69 | Academia da Criatividade, ateliê |
| Gênio | 70–89 | Academia das Descobertas, projetos |
| Sábio | 90–119 | mentorias, desafios lendários |
| Lenda | 120+ | Sua Ilha, conteúdo sazonal, cosméticos exclusivos |

Conteúdo essencial de segurança digital, autocuidado e noções básicas de dinheiro aparece desde o
nível 1, em missões curtas dentro da Academia do Conhecimento (Bíblia, Cap. 4 §4.9).

**Nunca há perda de XP nem rebaixamento de tier.** Regressão é desmotivadora e pedagogicamente inútil.

## 2. Domínio de competência (mastery)

- Modelo BKT com parâmetros por competência: `P(L0)=0.15`, `P(T)=0.12`, `P(slip)=0.10`, `P(guess)`
  derivado do tipo de atividade (ex.: 0.25 em múltipla escolha de 4 opções, 0.02 em resposta construída).
- **Dominada** quando `P(L) ≥ 0.85` **e** ≥ 3 tentativas **e** ≥ 2 acertos consecutivos em atividades
  de dificuldade ≥ `difficultyRef`. As três condições evitam falso domínio por chute.
- Domínio **decai** com o tempo se não revisado: `P(L)` sofre esquecimento de 2% ao dia sem prática,
  com piso de 0.5 para conteúdo já dominado (nunca "desaprende" do zero).
- Habilidade (Elo) do jogador: `ability += K × (resultado − esperado)`, `K = 32` nas 20 primeiras
  tentativas, depois 16. A dificuldade da atividade é recalibrada simetricamente por job noturno
  usando ≥ 200 tentativas — o conteúdo se auto-calibra com o uso.

## 3. Desbloqueio e progressão de missões

Uma missão é jogável quando `unlockRule` é satisfeita. Regras declarativas:
```json
{ "all": [ { "level": { "gte": 12 } },
           { "questCompleted": "quest_xyz" },
           { "masteryAvg": { "skills": ["s1","s2"], "gte": 0.6 } } ] }
```
- **Chefão** exige `masteryAvg ≥ 0.75` nas `requiredSkills` do capítulo. Se não atingido, o mapa
  mostra o caminho ("Treine 2 missões em Frações para enfrentar o Guardião"), nunca só um cadeado.
- Missão concluída pode ser rejogada; recompensa de repetição decai (100% → 30% → 10% → 0%) e o XP
  segue a regra de `difficultyFactor`. Rejogar para praticar é livre; farmar não compensa.

## 4. Energia (regra ética)

- Máximo 100, regenera **1 a cada 6 minutos** (cálculo por diferença de tempo, sem job).
- Custo: 5 por missão de campanha, 3 por revisão, **0 em missões da escola, 0 em revisão pendente,
  0 no tutor e 0 em qualquer conteúdo novo da trilha recomendada**.
- Energia zerada **não impede jogar**: a missão continua disponível, apenas sem recompensa
  cosmética/moeda (XP e domínio continuam contando integralmente).
- Energia **não é vendável por dinheiro real** em nenhuma hipótese (teste de política).

**Racional:** a energia existe para ritmar sessões saudáveis e valorizar variedade, não para
extrair tempo ou dinheiro. Bloquear aprendizagem violaria P1 e P2.

## 5. Economia

| Moeda | Como obtém | Para que serve |
|---|---|---|
| **Moedas** | missões, revisão, desafios diários | cosméticos comuns, móveis, itens do mascote |
| **Cristais** | chefões, conquistas, sequências de 7 dias | itens raros, evolução do mascote, veículos |
| **Diamantes** | eventos, projetos concluídos, marcos de domínio real | itens lendários, personalização de mundo |

Regras invariantes (garantidas em transação + razão contábil):
1. Saldo **nunca** fica negativo (`balanceAfter ≥ 0`, checado no domínio e por `CHECK` no banco).
2. Toda mutação tem `idempotencyKey`; retry de rede ou sync offline nunca credita duas vezes.
3. Recompensa de missão é creditada **uma única vez** por `QuestRun` (`rewardsGrantedAt`).
4. `Wallet` é projeção do `LedgerEntry`; job noturno reconcilia e registra divergências.
5. Preço de loja é lido do servidor no ato da compra — preço enviado pelo cliente é ignorado.
6. Nenhum item afeta desempenho de aprendizagem ou dificuldade (sem pay-to-win, sem "pular fase").

## 6. Sequência (streak)

- Conta dias com ≥ 1 missão concluída, no fuso do responsável.
- **Escudo de sequência:** a criança acumula 1 escudo a cada 5 dias (máx. 2). Faltar um dia consome
  escudo em vez de zerar. Sem escudo, a sequência reduz a 0 mas o *recorde* é preservado e exibido.
- Sem notificação de culpa. O lembrete opcional é enviado ao **responsável**, não à criança.
- Fim de semana e feriado configuráveis como "dias livres" pelo responsável.

## 7. Seleção adaptativa de atividades

Para preencher um slot dinâmico:
1. Candidatas = atividades do `objectiveId` com status `PUBLISHED`, faixa etária compatível, locale ok.
2. Excluir vistas nas últimas 48h (a menos que sejam item de revisão vencido).
3. Alvo de dificuldade = `ability + 60` (≈ 80% de acerto esperado no modelo Elo).
4. Ordenar por `|difficulty − alvo|`, com ruído controlado para variedade; diversificar tipo de
   atividade (não repetir o mesmo tipo 3× seguidas).
5. Cota: ≤ 20% da sessão vem da fila de revisão; ≥ 1 atividade sempre "confortável" no fim da
   sessão (encerrar com sucesso).
6. Se a criança errar 3 seguidas: injetar atividade de suporte (pré-requisito), reduzir alvo em 100
   e oferecer o tutor.

## 8. Tutor IA

- Nunca entrega a resposta final de uma atividade em avaliação; conduz por perguntas e analogias.
- Limite de custo: orçamento diário de tokens por criança (padrão) — ao esgotar, cai em conteúdo de
  ajuda curado, sem mensagem de erro para a criança.
- Transcrição sempre visível ao responsável; sinalização automática de risco (autolesão, violência,
  abuso) notifica o responsável em até 5 minutos e registra em auditoria.
- Desligável por criança (`LearnerSettings.aiTutorEnabled`) e por escola.
- Conteúdo gerado por IA é validado contra o `configSchema` do plugin **antes** de ser exibido; 10%
  da produção vai para revisão humana amostral; conteúdo com taxa de erro anômala é despublicado
  automaticamente.

## 9. Perfil de talentos

- Recalculado a cada 50 tentativas ou semanalmente, o que vier primeiro.
- Sinais: taxa de acerto relativa por área, tempo voluntário, escolha livre de missões, persistência
  após erro, uso de atividades criativas.
- `confidence < 0.6` → perfil não é exibido a ninguém.
- **Teto de recomendação:** máx. 40% das sugestões diárias vindas do talento dominante; mínimo 1
  sugestão de área "fora do perfil" por dia (P3).
- Exibido ao responsável como *tendência observada*, com linguagem não determinística e um aviso
  explícito de que não é diagnóstico nem limite.

## 10. Controles parentais

- Limite diário: aviso aos 80%, aos 100% a sessão vai para `/pausa` **após a etapa atual** (nunca no
  meio de uma atividade — perder progresso é punição injusta).
- Janelas de horário bloqueiam o início de novas missões, nunca interrompem à força.
- Toda alteração exige PIN, é registrada em `AuditLog` e informada à criança de forma neutra
  ("hoje o tempo de jogo termina às 18h").
- Academias podem ser desabilitadas individualmente; conteúdo escolar nunca é bloqueável pela escola
  sem consentimento do responsável.

## 11. Consistência transacional

Na mesma transação de `submitAttempt`: `Attempt`, `SkillMastery`, `ReviewCard`, `LearnerProgress`
(XP/energia), `LedgerEntry`+`Wallet`, `QuestRun`, `OutboxMessage`.
Fora da transação (via outbox): conquistas de longo prazo, talentos, telemetria, notificações,
geração de IA, relatórios. Nível de isolamento `READ COMMITTED` com atualização condicional
(`WHERE version = ?`) nas linhas quentes; conflito → retry com backoff (máx. 3).

## 12. Regras codificadas como testes de política

`tests/policy/` falha o build se alguma destas for violada:
1. Nenhuma oferta de loja com `currency` comprável por dinheiro real.
2. Nenhum caminho de código que bloqueie atividade por energia.
3. `EvaluationResult` incorreto sem `feedback.teaching`.
4. Nenhuma notificação push destinada a `Learner`.
5. Nenhuma consulta de ranking global por XP absoluto entre crianças de famílias diferentes.
6. Nenhum campo de texto livre da criança visível para outra criança.
7. Nenhum evento de telemetria contendo `learnerId` real (só `pseudonymId`).

## 13. Motor de Aprendizagem Adaptativa (ADR 0005)

A plataforma observa **como** cada criança aprende melhor e adapta a apresentação — nunca o
conteúdo pedagógico, nunca a dificuldade por este mecanismo (isso já é `SkillMastery`/Elo, §2).
**Regra absoluta, sem exceção: em código, copy, saída de IA ou nome de campo, o sistema nunca
diagnostica, rotula ou implica condição médica ou psicológica alguma.** Toda chave de dimensão
descreve um eixo de apresentação (`suporteVisual`, `instrucaoPassoAPasso`,
`independenciaDeLeitura`...), nunca uma condição — verificado por scan automatizado de termos
proibidos em `tests/policy/`, aplicado tanto ao domínio (`dimension-rules.test.ts`,
`accessibility-recommendation.test.ts`) quanto ao texto que chega de verdade na tela do
responsável (`personalizacao-da-aprendizagem.test.ts`).

**13.1 — Como uma dimensão se forma.** Cada `Attempt` avaliado (`assessment.attempt_evaluated`,
outbox) atualiza a dimensão relevante da atividade respondida — se a atividade não declarou
nenhuma característica de apresentação (`Activity.requiresReading`/`visualSupportLevel`/
`stepCount`), o evento não ensina nada ao perfil. `confiança = n / (n + 8)`: com 37 observações,
~82%. Idempotente **por recomputação**, não por acumulação — o outbox é *at-least-once*, então a
dimensão é sempre recalculada a partir de todas as tentativas já persistidas, nunca "+1 por
evento" (mesmo raciocínio de conquistas, §12 nesta doc não se aplica mas o padrão é o mesmo de
`achievement`).

**13.2 — Limiar único de evidência para agir.** `confiança ≥ 0.5` (n ≥ 8, o mesmo K da suavização)
**e** `valor ≥ 0.6` (desempenho médio "melhor que só parcial"). Esta é a MESMA política para as
duas decisões que o sistema toma sozinho — nunca podem divergir sobre o que conta como evidência
suficiente:
- **Escolher uma apresentação para esta tentativa** (§13.3) — reversível, silencioso, específico à
  atividade.
- **Sugerir uma configuração persistente** (§13.4) — visível, pedida, e só o responsável decide.

**13.3 — Seleção de apresentação (automática, sem confirmação).** Quando uma atividade declara
`variantesDeApresentacao` (até 5, mesma pergunta pedagógica, formas diferentes — texto puro,
texto+imagem, passo a passo...), o motor escolhe a de maior `valor × confiança` entre as
qualificadas pelo limiar de §13.2; sem evidência suficiente, ou sem variante que qualifique, a
apresentação padrão sempre vence. Isto é **efeito visual e de instrução, não desbloqueio nem
avaliação** — a mesma pergunta, a mesma resposta certa, o mesmo XP; só a forma muda. Não pede
confirmação do responsável porque é reversível a cada tentativa e não persiste nada — a próxima
atividade pode escolher diferente se o perfil mudar.

**13.4 — Sugestão de configuração (nunca aplicada sem o responsável).** Quando uma dimensão cruza
o limiar de §13.2 e a configuração manual correspondente ainda não está ligada, o sistema cria uma
`Recommendation` (`kind = "ACCESSIBILITY_SUGGESTION"`) com um motivo em linguagem neutra —
"padrão observado", nunca causa ou diagnóstico. O responsável vê a sugestão na tela
"Personalização da aprendizagem" e decide: **ativar**, **recusar**, ou ignorar (a sugestão
continua disponível). Nada é escrito em `LearnerSettings` sem essa decisão explícita — o sistema
nunca liga uma configuração sozinho, e uma recomendação pendente nunca se duplica para a mesma
dimensão.

**13.5 — Controle manual sempre disponível.** Toda dimensão com regra de sugestão tem uma
configuração manual correspondente na mesma tela, ligável/desligável a qualquer momento —
inclusive para desfazer o que uma sugestão ativou. Igual a §10 (controles parentais): a mudança é
do responsável, registrada em `AuditLog`, nunca silenciosa.
