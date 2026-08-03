# Preâmbulo — Estatuto da Bíblia Pedagógica

> **Bíblia Pedagógica · Volume 1 · Preâmbulo**
> Versão 1.0 · Status: **em aprovação**

---

## 1. O que este documento é

A Bíblia Pedagógica é a **Constituição** de Crescendo e Aprendendo. Ela define quem somos, o que
ensinamos, como ensinamos, no que acreditamos e o que jamais faremos. Tudo o que for construído
— código, design, conteúdo, personagens, mundos, inteligência artificial, banco de dados, campanha
de marketing, plano comercial — deriva daqui.

Este documento não descreve *uma* versão do produto. Ele descreve a **identidade** do produto.
Versões mudam; a identidade não.

## 2. Por que uma plataforma educacional precisa de uma Constituição

Produtos digitais para crianças falham quase sempre da mesma forma: começam com uma boa intenção
pedagógica e, sob pressão de métricas, derivam para mecânicas de retenção. Ninguém decide "vamos
prejudicar crianças" — a deriva acontece em decisões pequenas, cada uma defensável isoladamente:
uma notificação a mais, um bloqueio de conteúdo por energia, um ranking que gera comparação, uma
recompensa que compra atenção em vez de merecê-la.

A defesa contra essa deriva não é a boa vontade do time. É um documento com **autoridade superior**
à do backlog, ao qual qualquer pessoa da empresa pode apelar para vetar uma decisão — inclusive
contra a vontade de quem tem mais senioridade.

É por isso que a Bíblia existe, e é por isso que ela vem antes do código.

## 3. Hierarquia normativa

Em caso de conflito, prevalece sempre o documento de maior hierarquia:

| Nível | Documento | Autoridade |
|---|---|---|
| 1 | **Bíblia Pedagógica (Volumes 1+)** | Soberana. Nada pode contradizê-la. |
| 2 | Documentos de planejamento técnico (`docs/00`–`docs/12`) | Traduzem a Bíblia em arquitetura. Cedem em conflito. |
| 3 | ADRs (`docs/adr/`) | Decisões técnicas pontuais. Cedem aos níveis 1 e 2. |
| 4 | Backlog, tickets, especificações de feature | Execução. Cedem a tudo acima. |
| 5 | Preferência individual, urgência comercial, prazo | Nunca prevalece sobre os níveis acima. |

**Regra prática:** se uma tarefa do backlog só pode ser cumprida violando a Bíblia, a tarefa está
errada — não a Bíblia.

## 4. Como emendar

A Bíblia é firme, não imutável. Uma emenda exige:

1. **Proposta escrita** (arquivo `docs/biblia/emendas/EMENDA-NNN-titulo.md`) contendo: o texto atual,
   o texto proposto, o problema real que motivou a mudança e as evidências que a sustentam.
2. **Parecer pedagógico** de responsável com formação em educação ou psicologia infantil.
3. **Análise de impacto** nas crianças, nos responsáveis e nas escolas — não apenas no produto.
4. **Aprovação do responsável pelo produto** e registro da versão.
5. **Período de revisão de 7 dias** antes de valer, para que qualquer pessoa possa objetar.

Emendas que reduzam proteção à criança exigem, além disso, justificativa explícita de por que a
proteção anterior era desnecessária — e não apenas inconveniente.

Os capítulos 1 (Fundamentos) e os artigos marcados **[PÉTREO]** só podem ser alterados por decisão
formal da liderança da empresa, com registro público na página de transparência. São eles que
impedem que a plataforma se torne aquilo que ela nasceu para não ser.

## 5. Como usar este documento no dia a dia

| Papel | Quando consultar |
|---|---|
| **Engenharia** | antes de modelar dados, criar mecânica de recompensa, integrar IA ou tocar em privacidade |
| **Design** | antes de definir tom, cor, movimento, som, texto de erro ou tela de fracasso |
| **Conteúdo/Pedagogia** | antes de escrever qualquer atividade, história ou personagem |
| **IA** | antes de escrever qualquer prompt de sistema — o Capítulo 8 é o contrato do tutor |
| **Produto** | ao priorizar; toda proposta deve citar qual objetivo do Capítulo 1 ela serve |
| **Marketing e vendas** | ao prometer qualquer coisa a famílias e escolas. Não prometemos o que a Bíblia não sustenta |

Toda revisão de código, de design ou de conteúdo pode ser recusada com uma única frase:
**"Isto contraria o Volume 1, Capítulo X."** Essa objeção não precisa de mais argumento — quem
propõe é que precisa demonstrar que não há contradição, ou propor uma emenda.

## 6. Estrutura do Volume 1

| Cap. | Título | Responde |
|---|---|---|
| 1 | [Fundamentos](01-fundamentos.md) | quem somos e no que acreditamos |
| 2 | [Público](02-publico.md) | para quem construímos e que dor resolvemos |
| 3 | [O Universo](03-universo.md) | onde a história acontece e por quê |
| 4 | [As Sete Academias](04-as-sete-academias.md) | o que ensinamos e como se conecta |
| 5 | [Academia da Prosperidade](05-academia-da-prosperidade.md) | nosso maior diferencial |
| 6 | [Sistema de Evolução](06-sistema-de-evolucao.md) | como a criança cresce |
| 7 | [Personagens](07-personagens.md) | quem habita o mundo |
| 8 | [Inteligência Artificial](08-inteligencia-artificial.md) | como a IA ensina e conversa |
| 9 | [Pais](09-pais.md) | o que entregamos às famílias |
| 10 | [Professores](10-professores.md) | o que entregamos às escolas |
| 11 | [Identidade Visual e Sensorial](11-identidade-visual.md) | como o mundo se parece e soa |
| 12 | [Roadmap de 5 anos](12-roadmap-5-anos.md) | onde chegaremos |

## 7. Volumes futuros

| Volume | Conteúdo previsto |
|---|---|
| **1** | Constituição: identidade, universo, academias, evolução, personagens, IA, públicos, roadmap |
| **2** | Currículo detalhado: mapa BNCC completo por ano, progressões de aprendizagem, taxonomia de equívocos |
| **3** | Manual de conteúdo: como escrever missões, atividades, diálogos e histórias; padrões de qualidade |
| **4** | Manual de personagens e narrativa: arcos, temporadas, roteiros, direção de dublagem |
| **5** | Manual de IA: prompts de sistema, guardas, avaliação de qualidade pedagógica, protocolo de risco |
| **6** | Manual de escolas: implantação, formação de professores, alinhamento a projetos político-pedagógicos |

**O Volume 2 só começa após a aprovação formal deste Volume 1.**

---

*Assinatura de aprovação — preencher na aprovação:*

| Papel | Nome | Data |
|---|---|---|
| Responsável pelo produto | | |
| Responsável pedagógico | | |
| Responsável técnico | | |
