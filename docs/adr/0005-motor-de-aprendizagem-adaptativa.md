# ADR 0005 — Motor de Aprendizagem Adaptativa

- **Status:** Aceito
- **Data:** 2026-08-15

## Contexto

Crianças diferentes aprendem melhor de formas diferentes — algumas precisam de mais apoio visual,
outras de instrução dividida em passos curtos, outras leem com independência e outras ainda
dependem de leitura em voz alta. Pedido explícito do dono da plataforma: o sistema deve descobrir
progressivamente **como** cada criança aprende melhor e adaptar a *apresentação* das atividades —
sem nunca diagnosticar, rotular ou implicar condição médica ou psicológica alguma, em código, copy,
saída de IA ou nome de campo. Uma plataforma só, um motor de atividades só (`docs/13`); adaptação
como camada por cima, nunca um segundo motor.

A alternativa óbvia — inferir uma condição (ex.: "sinais de TDAH") e ajustar com base nisso — foi
descartada de saída: é responsabilidade clínica que a plataforma não tem título para assumir, cria
risco de rotulação permanente de uma criança a partir de um padrão estatístico raso, e é
irreversível na forma como uma família e uma escola passam a enxergar aquela criança. A pergunta
certa nunca é "o que esta criança tem", é "o que parece ajudar esta criança a aprender".

## Decisão

**Perfil de modalidade, não de talento nem de condição.** Um novo módulo, `learning-profile`,
mantém por criança um conjunto de **dimensões de apresentação** (`suporteVisual`,
`instrucaoPassoAPasso`, `independenciaDeLeitura`...) — nunca dimensões de capacidade (isso já é
`SkillMastery`/Elo) nem de interesse (isso já é `TalentProfile`). Cada dimensão é um `value` (0..1,
quanto aquele suporte parece ajudar) e uma `confidence` (0..1, quanta evidência há) — nunca um
rótulo categórico. O conjunto de dimensões é aberto: uma dimensão nova é uma linha
(`LearningProfileDimension`), nunca uma migration, mesmo raciocínio de `docs/13` para tipos de
atividade.

**Dois efeitos, dois níveis de confirmação, um único limiar de evidência** (`docs/08 §13.2`):
1. **Seleção de apresentação por tentativa** — automática, sem pedir nada a ninguém. O motor de
   atividades continua recebendo só um `config` pronto; a escolha entre a apresentação padrão e até
   5 variantes declaradas em `content/` acontece na borda (`content-bridge.ts`), nunca dentro do
   motor. Reversível a cada tentativa, não persiste nada — se o perfil mudar, a próxima escolha
   pode ser diferente.
2. **Sugestão de configuração persistente** — nunca aplicada sozinha. Ao cruzar o mesmo limiar de
   evidência, o sistema cria uma `Recommendation` com motivo em linguagem neutra ("padrão
   observado", nunca causa). O responsável vê a sugestão na tela "Personalização da aprendizagem" e
   decide: ativar, recusar, ou configurar manualmente qualquer uma das opções de acessibilidade a
   qualquer momento — a tela nunca aplica nada sem essa decisão explícita.

**Módulos permanecem donos do que já eram donos.** `learning-profile` reage a
`assessment.attempt_evaluated` pelo outbox (idempotente por recomputação, não por acumulação —
o mesmo raciocínio de `achievement`) e nunca escreve `LearnerSettings` diretamente; devolve o que
aplicar, e um Server Action do lado do responsável orquestra a escrita via `identity` — o mesmo
padrão de `assessment` nunca creditar XP sozinho.

## Consequências

- **Positivas:** a plataforma melhora a experiência de aprendizagem sem nunca cruzar a linha de
  diagnóstico — testado automaticamente (scan de termos proibidos em `tests/policy/`, aplicado ao
  domínio e ao texto real da tela do responsável); o responsável mantém controle total e visível
  sobre qualquer adaptação persistente, nunca surpreendido por uma mudança silenciosa; o modelo de
  dimensão flexível (linha, não coluna) permite crescer o número de eixos observados sem
  migration; o motor de atividades (`docs/13`) permanece **puro** — nunca soube, e continua sem
  saber, que existe escolha de apresentação, preservando a garantia de Open/Closed da ADR 0002.
- **Custo aceito:** duas decisões (escolher variante, sugerir configuração) precisam compartilhar
  exatamente a mesma política de evidência suficiente (`CONFIANCA_MINIMA_PARA_AGIR`,
  `VALOR_MINIMO_PARA_AGIR`) para nunca divergir sobre o que é "evidência suficiente" — centralizado
  em `domain/dimension.ts`, testado por ambos os consumidores.
- **Risco mitigado:** `academyId` no perfil existe no schema mas nenhuma escrita o usa hoje (sempre
  `null`, perfil global) — decisão explícita de não fragmentar evidência por academia antes de
  haver dado que justifique; qualquer leitura futura precisa respeitar esse mesmo escopo, ou nunca
  encontra evidência nenhuma (bug real, encontrado e corrigido durante a Fase 3b: a seleção de
  variante lia por academia enquanto a escrita gravava só o global).
- **Fora de escopo desta decisão:** inferência sobre a criança a partir de qualquer sinal que não
  seja desempenho em atividades já respondidas (sem câmera, sem áudio, sem biometria); qualquer
  adaptação de dificuldade ou de conteúdo pedagógico por este mecanismo (isso continua sendo
  `SkillMastery`/Elo, `docs/08 §2`); qualquer rótulo exposto à criança — a criança nunca vê o
  perfil, nunca vê "por que" uma tela parece diferente.
