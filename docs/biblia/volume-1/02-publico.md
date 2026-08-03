# Capítulo 2 — Público

> **Bíblia Pedagógica · Volume 1 · Capítulo 2**

Servimos três públicos com necessidades diferentes e, às vezes, conflitantes. Este capítulo define
quem são, o que cada um precisa, e como resolvemos os conflitos entre eles.

**Regra de arbitragem:** criança > responsável > escola > empresa. Quando o desejo de um adulto
conflita com o bem-estar da criança, a criança vence (V1).

---

## 2.1 Faixas etárias e o que a idade impõe ao design

A idade não é um filtro de conteúdo. Ela determina **como a interface funciona**, **quanto texto
existe**, **quanto tempo dura uma sessão** e **que tipo de raciocínio é possível**. Um erro comum
em produtos infantis é tratar "6 a 12 anos" como um público só — a distância cognitiva entre 6 e 12
é maior que entre 25 e 40.

### 6–8 anos · `SPROUT` — "A Semente"

**Desenvolvimento:** transição do pré-operatório para o operatório concreto (Piaget). Pensa sobre o
que pode ver e manipular. Alfabetização em curso — muitas crianças ainda não leem com fluência.
Motricidade fina em desenvolvimento: erra alvos pequenos. Atenção sustentada de 8 a 12 minutos.
Memória de trabalho: 2 a 3 elementos simultâneos. Egocentrismo cognitivo ainda presente: entende o
mundo a partir de si.

**O que isso obriga:**
- Toda instrução em **áudio**, com texto como reforço. Ler não pode ser pré-requisito para jogar.
- Alvo de toque ≥ 56 px; nada de arrastar com precisão; erro de toque nunca pune.
- Uma decisão por tela; no máximo 3 opções visíveis.
- Sessão-alvo de 8 a 12 minutos, com fechamento natural.
- Feedback exuberante e imediato — nesta idade, celebração funciona e é justa.
- Personagens falam com a criança em segunda pessoa e pelo nome do apelido.
- Zero abstração simbólica sem manipulação concreta anterior (PP2).

### 9–12 anos · `EXPLORER` — "O Explorador"

**Desenvolvimento:** operatório concreto pleno; início do pensamento hipotético em alguns. Lê para
aprender (não mais aprende a ler). Compara-se socialmente com intensidade crescente — é aqui que
nasce "eu não sou bom em matemática". Atenção sustentada de 15 a 25 minutos. Busca autonomia e
detesta ser tratada como criança pequena. Senso de justiça agudo: percebe e rejeita manipulação.

**O que isso obriga:**
- Tom que respeita a inteligência: nada de bebezice, nada de voz aguda demais, nada de "parabéns,
  campeão!" gratuito.
- Autonomia real: escolher missão, ordem, personalização, caminhos alternativos.
- Estratégia e profundidade: chefões, coleções, segredos, desafios de vários passos.
- Proteção redobrada contra comparação social — é a idade de maior risco de dano ao autoconceito.
- Explicação do "porquê", não só do "como". Esta criança pergunta para que serve.

### 13–15 anos · `PIONEER` — "O Pioneiro" *(fase futura)*

Operatório formal: abstração, hipótese, argumentação. Identidade e pertencimento tornam-se centrais.
Rejeita estética infantil de forma quase alérgica.
**Obriga:** troca completa de linguagem visual (mesmos tokens, outro tema), projetos longos,
protagonismo real, e um sistema de progressão que não pareça infantil.

### 16–17 anos · `VANGUARD` — "A Vanguarda" *(fase futura)*

Projeto de vida, vestibular, primeiro trabalho, autonomia financeira real.
**Obriga:** portfólio, trilhas profissionalizantes, e — na Prosperidade — a ponte cuidadosa entre a
simulação e o mundo real, sempre dentro dos limites do Capítulo 5.

**Por que definimos as quatro faixas agora, se só entregamos duas:** porque a decisão de arquitetura
que permite crescer sem reescrever precisa ser tomada antes da primeira linha de código
(`docs/10 §7`). Faixa etária é enum, tema, filtro de conteúdo e variação de texto desde o dia 1.

---

## 2.2 Perfil das crianças

Não desenhamos para uma criança média — ela não existe. Desenhamos para cinco perfis reais que
coexistem, muitas vezes na mesma criança em dias diferentes.

### C1 — "A que já desistiu"
Tem 9 anos e já se declarou ruim em alguma matéria. Evita a atividade antes de tentar, chuta para
acabar logo, e interpreta o erro como confirmação de uma identidade.
**Nossa resposta:** dificuldade calibrada para o sucesso com esforço, erro sem humilhação, progresso
visível em domínio (não em nota), tutor que devolve autoria, e a primeira vitória acontecendo nos
primeiros 5 minutos. *Esta é a criança mais importante do produto. Se funcionamos para ela,
funcionamos para todas.*

### C2 — "A que corre na frente"
Termina rápido, entedia-se, e o sistema escolar a mantém em ritmo alheio.
**Nossa resposta:** avanço automático, desafios lendários, conteúdo de profundidade nas Academias da
Inteligência e das Descobertas, e a possibilidade de ir fundo em vez de só ir adiante.

### C3 — "A que precisa de tempo"
Aprende, mas em outro ritmo. Em sala, é a que fica para trás porque a turma anda junto.
**Nossa resposta:** ausência total de prazo, de cronômetro em conteúdo e de comparação; repetição em
contextos diferentes; o mesmo destino, em outro ritmo.

### C4 — "A que precisa de outro caminho"
Dislexia, TDAH, TEA, deficiência visual ou auditiva, ou simplesmente um jeito diferente de entender.
**Nossa resposta:** acessibilidade como padrão (V6): fonte para dislexia, alto contraste, redução de
movimento, leitura em voz alta, teclado, modo alternativo obrigatório em todo minigame, sessões
curtas e previsíveis, e ausência de estímulo sensorial obrigatório.

### C5 — "A que tem tudo, menos presença"
Tem dispositivo, internet e escola boa — mas não tem, às 20h, um adulto disponível para explicar de
novo.
**Nossa resposta:** o tutor, a paciência infinita e a explicação que nunca se irrita.

### Contexto material (requisito, não detalhe)
Presumimos: aparelho compartilhado e antigo, tela de 5", conexão instável ou ausente, uso em
transporte público, e ausência de adulto por perto. Isso é o que justifica PWA com offline real,
orçamento agressivo de desempenho e áudio local (`docs/11`).

---

## 2.3 Perfil dos pais

O responsável decide a compra, mas raramente é quem usa. Ele precisa de **prova, controle e paz**.

### P1 — "A mãe cansada" *(persona majoritária)*
Trabalha, chega em casa às 19h, tem culpa por dar tela e nenhuma energia para brigar por lição.
**Precisa:** algo que ela permita sem culpa; prova em 30 segundos de que valeu a pena; controle de
tempo que funcione sem virar briga.
**Fracasso para ela:** um relatório que exige 10 minutos de leitura; uma criança que chora ao ser
interrompida.

### P2 — "O pai preocupado com segurança"
A primeira pergunta é "quem fala com meu filho aí dentro?".
**Precisa:** transparência total — ver transcrições do tutor, saber que não há chat, não há
publicidade, não há dado vendido; política de privacidade legível.
**Fracasso para ele:** qualquer ambiguidade sobre IA, dados ou contato com estranhos.

### P3 — "A mãe engajada"
Quer acompanhar, entender dificuldade e ajudar em casa.
**Precisa:** relatório por competência com evidência real; sugestões acionáveis do tipo "faça esta
brincadeira de 10 minutos com ela"; missões em família.

### P4 — "O pai que quer resultado escolar"
Comprou por causa da nota baixa.
**Precisa:** alinhamento BNCC visível, correspondência com o que a escola cobra, evolução mensurável.
**Cuidado ético:** não prometemos nota. Prometemos domínio — e explicamos a diferença com
honestidade (V2).

### P5 — "O responsável que não domina o conteúdo"
Não estudou até o fim, ou aprendeu de outro jeito, e sente vergonha de não saber ajudar.
**Precisa:** linguagem sem jargão, ausência de julgamento, e a possibilidade de aprender junto.
**Consequência de produto:** todo relatório é escrito para ser entendido por quem não é professor —
essa é uma restrição de redação, verificada em revisão.

### O que todos têm em comum
Querem responder três perguntas: *Meu filho está aprendendo? Está seguro? Está feliz?*
O painel dos pais responde exatamente essas três, nessa ordem (Capítulo 9).

---

## 2.4 Perfil das escolas

### E1 — Escola privada de médio porte
Compra diferencial competitivo e comunicação com as famílias.
**Precisa:** identidade visual forte, relatórios que impressionem os pais, implantação simples,
alinhamento BNCC documentado para a coordenação.

### E2 — Rede pública municipal
Compra por licitação, com orçamento apertado e infraestrutura limitada.
**Precisa:** funcionar em Chromebook antigo e internet ruim; formação de professores incluída;
relatórios agregados para a secretaria; conformidade com a LGPD do setor público; funcionar offline.
**É o público que mais testa a arquitetura — e o de maior impacto social.**

### E3 — Escola com projeto pedagógico próprio
Só adota o que se encaixa em sua metodologia.
**Precisa:** flexibilidade — escolher academias, montar trilhas próprias, desligar o que não combina,
inclusive a gamificação competitiva.

### E4 — Reforço, contraturno e ONGs
**Precisa:** diagnóstico rápido de lacunas, trilha de recuperação, relatório por aluno e uso
autônomo com pouca mediação.

**Restrição constitucional para o mercado escolar:** a escola pode configurar o uso, mas **não pode
sobrepor as proteções da criança**. Não implementamos ranking público de alunos, não expomos dados
de uma criança a outra família, e não desligamos as garantias do Capítulo 1 a pedido de cliente.
Perder uma venda por isso é um custo aceito.

---

## 2.5 Perfil dos professores

O professor é o público mais cético — com razão. Já viu muita tecnologia prometer e dar trabalho.

### Realidade dele
30 a 40 alunos por turma, em níveis que variam de 3 anos de defasagem. Tempo de planejamento curto e
frequentemente não remunerado. Cansaço com sistemas que exigem cadastrar tudo de novo. Medo,
justificado, de ser substituído por tecnologia.

### O que ele precisa, em ordem de importância
1. **Economizar tempo dele.** Se dá mais trabalho do que resolve, não será usado — por melhor que seja.
2. **Ver a turma em 10 segundos:** quem travou, em quê, e o que fazer amanhã.
3. **Diagnóstico que ele não consegue fazer sozinho:** com 35 alunos, é impossível saber que 7 deles
   erram frações pelo mesmo motivo. Nós sabemos, e dizemos.
4. **Autonomia:** montar a atividade dele, escolher competências, ajustar prazo.
5. **Respeito:** a IA sugere plano de aula; o professor edita, aprova ou ignora. Nunca "a IA
   determinou".

### Nosso compromisso explícito com o professor
> A plataforma existe para devolver ao professor o tempo que ele gasta com correção e diagnóstico,
> para que ele use esse tempo com as crianças. Nenhuma funcionalidade nossa pode ser vendida como
> substituição de professor — nem para escolas, nem em marketing. **[PÉTREO]**

---

## 2.6 Dificuldades que a plataforma resolve

| Para quem | Dor real | Nossa resposta | Como sabemos que funcionou |
|---|---|---|---|
| Criança | "Eu não sou boa nisso" | Dificuldade calibrada, erro sem humilhação, domínio visível | Autoconceito medido por sondagem lúdica no início e após 90 dias |
| Criança | Conteúdo entediante e desconectado | Conteúdo *é* o jogo (PG1); narrativa com propósito | Sessões iniciadas espontaneamente ≥ 60% |
| Criança | Ritmo único da sala de aula | Adaptatividade individual | Curva de acerto entre 75% e 85% para todos os perfis |
| Criança | Ninguém para explicar às 21h | Tutor IA socrático, sempre disponível | Taxa de recuperação após erro ≥ 70% |
| Criança | Lacunas acumuladas de anos anteriores | DAG de pré-requisitos + sondagem + revisão espaçada | Lacunas fechadas por trimestre |
| Responsável | Culpa pela tela | Tela que ensina, com prova e limite | NPS e menção qualitativa |
| Responsável | Não sabe se está aprendendo | Relatório de domínio com evidência, em 30 segundos | Tempo de compreensão do relatório em teste de usabilidade |
| Responsável | Medo do ambiente digital | Sem chat, sem anúncio, sem dado vendido, transparência total | Auditoria e verificação independente |
| Responsável | Não domina o conteúdo | Linguagem simples + sugestões acionáveis | Uso das sugestões |
| Responsável | Briga diária pelo tempo de tela | Limite negociado com pausa acolhedora, não corte abrupto | Redução relatada de conflito |
| Escola | Defasagem heterogênea | Diagnóstico automático + trilhas individuais | Redução da dispersão de domínio na turma |
| Escola | Comprovar BNCC | Rastreabilidade por código e relatório de cobertura | Relatório aceito pela coordenação |
| Escola | Infraestrutura precária | PWA offline, baixo consumo | Funcionamento verificado em equipamento de referência |
| Professor | Correção e diagnóstico consomem o tempo | Correção automática + diagnóstico de equívoco | Horas devolvidas por semana |
| Professor | Não consegue individualizar com 35 alunos | Individualização automática + alertas | Alunos em risco identificados antes da avaliação |
| Professor | Planejar toma o fim de semana | Sugestão de plano a partir de lacunas reais | Adoção e tempo de planejamento |

### Uma dor que resolvemos e ninguém pede
**Educação financeira e empreendedorismo não existem na maior parte das escolas brasileiras.**
Nenhuma família procura a plataforma por isso — e quase todas reconhecem a falta quando veem. É por
essa razão que a Prosperidade se tornou uma Academia inteira, e não um módulo (Capítulo 5): ela é o
diferencial que ninguém pediu e que todos vão querer.
