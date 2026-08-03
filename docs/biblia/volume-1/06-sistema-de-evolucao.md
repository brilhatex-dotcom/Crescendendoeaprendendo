# Capítulo 6 — Sistema de Evolução

> **Bíblia Pedagógica · Volume 1 · Capítulo 6**
> Este capítulo define a economia e a progressão de Crescente. Toda regra aqui é vinculante e tem
> tradução técnica em `docs/08-regras-de-negocio.md`. Em caso de divergência, este capítulo prevalece.

---

## 6.1 A pergunta que governa todo este capítulo

> **Se amanhã removêssemos XP, moedas, medalhas e coleções, o produto ainda seria divertido?**

Se a resposta for não, o design falhou — porque significa que estamos comprando o comportamento da
criança em vez de merecê-lo (PP6). Toda mecânica deste capítulo é, portanto, um **marcador** de
conquista, nunca a razão dela.

Consequência direta e mensurável: mais tempo de tela **não** rende mais. O que rende é enfrentar o
desafio certo. É a diferença entre um sistema que extrai tempo e um que reconhece esforço.

---

## 6.2 Luz (XP)

**Nome no mundo:** Luz. **No sistema:** XP.
Cada pergunta que a criança faz e cada coisa que ela entende gera um fio da Corrente (Capítulo 3).

### Como se ganha

| Origem | Luz |
|---|---|
| Acerto na primeira tentativa | `10 × fator de desafio` |
| Acerto depois de uma dica | `6 × fator de desafio` |
| Acerto depois de ensino completo | `4 × fator de desafio` |
| Missão concluída | valor da missão |
| Colosso acordado | valor da missão × 1,5 |
| Revisão em dia (manter o mundo aceso) | 5 |
| Primeira sessão do dia | +20 |

**Fator de desafio** = `limitado(0,6 … 1,8) de [1 + (dificuldade da atividade − habilidade da
criança) / 400]`.

**Por que essa fórmula é o coração ético do sistema.** Ela faz três coisas simultaneamente:
1. Repetir conteúdo já fácil rende quase nada → farmar não compensa.
2. Encarar o desafio ligeiramente acima do próprio nível rende muito → a criança é puxada para a
   Zona de Desenvolvimento Proximal (PP1) por interesse próprio, não por obrigação.
3. Como a dificuldade é relativa à *criança*, uma criança com defasagem ganha exatamente tanto
   quanto a adiantada ao enfrentar o desafio certo. **A recompensa mede esforço, não nível.**

**Acertar depois de errar sempre rende.** Nunca zero. Errar, ser ensinada e acertar é o processo que
mais queremos, e seria absurdo pagá-lo com nada (PP5).

### O que nunca acontece
Perda de Luz, rebaixamento de nível, apagamento de progresso, "game over" (PG6, e regra R3 do mundo).

---

## 6.3 Níveis e Tiers

Curva: `Luz para o nível n = arredondar(120 × n^1,45)`. Rápida até o nível 10, estável depois — a
criança precisa sentir movimento nas duas primeiras semanas, e precisa que o nível continue
significando algo no ano seguinte.

| Tier | Níveis | Nome de Crescente | Desbloqueia |
|---|---|---|---|
| **Aprendiz** | 1–9 | *Faísca* | Ilha das Mil Perguntas, o Fagulha |
| **Explorador** | 10–19 | *Lanterna* | Ilha dos Nós, Ilha Pontal, primeira montaria, casa |
| **Inventor** | 20–34 | *Chama* | Ilha Engrena, oficina, ferramentas de criação |
| **Guardião** | 35–49 | *Brasa* | Ilha do Vilarejo, missões em família |
| **Mestre** | 50–69 | *Fogueira* | Ilha Aquarela, ateliê, galeria pessoal |
| **Gênio** | 70–89 | *Aurora* | Ilha Errante, expedições, projetos longos |
| **Sábio** | 90–119 | *Constelação* | desafios lendários, mentoria de personagens |
| **Lenda** | 120+ | *Farol* | **Sua Ilha** e conteúdo sazonal permanente |

O nome do Tier é o que a criança vê e diz aos amigos ("eu já sou Brasa"). O número do nível é
secundário na interface — é o Tier que carrega identidade.

---

## 6.4 Fôlego (energia)

**Regra constitucional [PÉTREO]: o Fôlego nunca impede aprender.**

- Máximo 100, regenera 1 a cada 6 minutos (recuperação total em 10 horas).
- **Custa Fôlego:** repetir missão já concluída (5), desafios extras de coleção (3).
- **Não custa Fôlego, jamais:** conteúdo novo da trilha, revisão pendente, missões da escola, o
  tutor, qualquer academia, qualquer Colosso.
- Com Fôlego zerado, a criança continua jogando tudo. O que muda é apenas a recompensa **cosmética**
  de repetição. Luz e domínio continuam contando integralmente.
- **Fôlego não é vendável, nunca, por nada** (PG2, e regra R8 do mundo: luz não se compra).

**Por que manter então?** Porque sem nenhum custo de repetição a criança ótima em farmar bate a
criança que aprende — e o ranking de coleções deixaria de significar aprendizagem. O Fôlego existe
para dar valor à variedade, não para vender atalho.

---

## 6.5 As três moedas

| Moeda | Nome no mundo | Como se ganha | Para que serve |
|---|---|---|---|
| Comum | **Fagulhas** | missões, revisão, desafios diários, feira da Prosperidade | cosméticos comuns, móveis, cuidados do Fagulha |
| Rara | **Prismas** | Colossos, conquistas, Trilha de Luz de 7 dias | itens raros, evolução do companheiro, montarias |
| Lendária | **Estrelas-Guia** | projetos concluídos, marcos de domínio real, Marés | itens lendários, personalização de Sua Ilha |

### Regras invariantes da economia
1. Saldo nunca fica negativo.
2. Recompensa creditada **uma única vez** por missão concluída (idempotência real, `docs/08 §5`).
3. Toda transação vai para um razão contábil auditável — saldo é consequência, não mágica.
4. Preço é sempre do servidor.
5. **Nenhuma moeda se compra com dinheiro real. Em nenhuma hipótese. [PÉTREO]**
6. **Nada comprável afeta aprendizagem** (PG9): tudo é estético ou narrativo. Nenhum item pula
   conteúdo, dá resposta, acelera domínio ou reduz dificuldade.

### Balanceamento
Uma sessão típica de 15 minutos rende de 60 a 120 Fagulhas. Um cosmético comum custa de 150 a 400
(2 a 4 sessões — desejo com espera curta). Um item raro custa de 8 a 15 Prismas (~2 semanas de jogo
consistente). O ritmo é calibrado para que **sempre exista algo desejado a poucos dias de distância**
e algo grande a semanas — nunca algo tão longe que desmotive (PG5).

---

## 6.6 Missões

**Definição constitucional:** uma missão é um **ato de restauração**. Toda missão responde à
pergunta *"o que volta a existir no mundo quando ela termina?"*. Missão que não responde não é
aprovada em revisão de conteúdo.

| Tipo | O que é | Duração |
|---|---|---|
| **História** | avança a narrativa do capítulo | 8–15 min |
| **Prática** | consolida uma competência | 5–10 min |
| **Desafio** | dificuldade acima, recompensa acima | 5–8 min |
| **Colosso** | chefão do capítulo | 10–20 min |
| **Revisão** | mantém o mundo aceso | 3–6 min |
| **Projeto** | vários dias, parcialmente offline (Descobertas) | dias/semanas |
| **Família** | exige um adulto junto | 15–30 min |
| **Diária** | desafio rotativo do dia | 3–5 min |

**Estrutura interna:** introdução narrativa curta (≤ 8 s, sempre pulável) → etapas com atividades →
resultado. Toda missão termina com uma atividade confortável: **a sessão sempre fecha em sucesso**
(PG4) — encerrar na frustração envenena o retorno no dia seguinte.

**Retomada:** progresso é salvo a cada resposta. Fechar o aplicativo no meio nunca custa nada.

---

## 6.7 Colossos Adormecidos (chefões)

O Colosso é a única mecânica de Crescente que exige **domínio comprovado**, não esforço acumulado.

- Só desperta com domínio médio ≥ 0,75 nas competências do capítulo.
- Sem domínio, o mapa **mostra o caminho** ("treine duas missões em Frações Equivalentes para
  despertar o Guardião de Pedra"). Nunca um cadeado seco — bloqueio sem caminho é punição.
- Não se vence por sorte nem por chute: é a validação real da aprendizagem, e é isso que dá peso à
  vitória.
- **Não morre. Acorda.** Vira parte da paisagem, cumprimenta a criança quando ela passa, e às vezes
  ajuda em missões futuras. A criança não destrói nada em Crescente — ela devolve coisas ao mundo.
- Derrota não existe: se a criança não consegue, o Colosso volta a dormir e ela é levada de volta ao
  treino sem perder nada, com uma fala de encorajamento do Colosso, não de deboche.

---

## 6.8 Marés (temporadas)

Quatro **Marés** por ano, de aproximadamente 12 semanas, alinhadas ao calendário escolar brasileiro:

| Maré | Período | Tema |
|---|---|---|
| **Maré da Semente** | fev–abr | recomeço, plantar, primeiras perguntas |
| **Maré do Sol Alto** | mai–jul | desafio, expedição, festa junina do arquipélago |
| **Maré das Correntes** | ago–out | construção, pontes, projetos coletivos |
| **Maré das Luzes** | nov–jan | celebração, retrospectiva, presentes, férias |

Cada Maré traz: um arco narrativo (o avanço da história de ECO, Capítulo 7), uma região temporária
na Ilha Errante, uma coleção exclusiva, e cosméticos que **não retornam** — escassez legítima de
conteúdo sazonal, jamais escassez artificial para induzir compra (PG2/PG8).

**Regra ética da temporada [PÉTREO]:** nenhuma Maré tem passe pago, nenhuma exige presença diária
para não perder recompensa, e nenhuma pune ausência. Quem entrou na metade da Maré consegue
concluí-la. Férias escolares e doença não podem custar nada à criança.

---

## 6.9 Eventos

- **Diários:** um desafio rotativo de 3 a 5 minutos, sem punição por pular.
- **Semanais:** a Ilha Errante ancora em um lugar novo, com uma expedição temática.
- **Sazonais:** festas do arquipélago ligadas ao calendário cultural brasileiro (junina, folclore,
  colheita, ano-novo), sempre com conteúdo pedagógico real por trás.
- **Eventos de comunidade:** metas coletivas de todas as crianças da plataforma ("juntos, acendemos
  1 milhão de lamparinas nesta semana"). Cooperação global, sem competição entre crianças e sem
  exposição de qualquer dado individual (PSI2).

---

## 6.10 Coleções

Colecionar é o motor de retorno mais poderoso e mais barato que existe — e o mais fácil de
distorcer. Nossas coleções obedecem a três regras: **toda peça tem significado, nenhuma peça é
aleatória paga, e nenhuma coleção pode ser completada com dinheiro.**

| Coleção | Como se obtém | Onde vive |
|---|---|---|
| **Diário do Saber** | uma página por competência dominada | Conhecimento |
| **Peças de Xadrez** | vitórias e marcas pessoais | Inteligência |
| **Selos de Confiança** | escolhas éticas e segurança digital | Vida / Prosperidade |
| **Autômatos** | criações e bugs resolvidos | Tecnologia |
| **Galeria Pessoal** | tudo que a criança criou, para sempre | Criatividade |
| **Caderno de Campo** | descobertas, espécimes, medições | Descobertas |
| **Quadro de Contas** | histórico econômico do jogador | Prosperidade |
| **Medalhas** | conquistas transversais, em 4 graus | Perfil |
| **Moradores** | personagens restaurados que voltaram a viver | Mapa |

A coleção mais valiosa é a de **Moradores**: cada um é um Apagado que a criança lembrou. É a
memória afetiva da jornada — e a prova, em forma de gente, de que ela consertou o mundo.

---

## 6.11 O Fagulha (companheiro)

Nasce da primeira pergunta da criança, no primeiro minuto de jogo. A criança escolhe a espécie e o
nome — e esse é o primeiro ato de autoria da jornada.

- **Cinco estágios de evolução**, ligados a domínio real e não a tempo de jogo: um Fagulha só evolui
  quando a criança acende Faróis. Ele é, literalmente, o retrato do aprendizado dela.
- **Afinidade** cresce com cuidado, missões juntos e uso do tutor.
- **É a voz do tutor IA** (Capítulo 8): a criança não conversa com "uma IA", conversa com seu
  companheiro. Isso cria vínculo, reduz estranhamento e resolve o problema de personificar a IA sem
  fingir humanidade (PIA6).
- **Nunca adoece, nunca fica triste por abandono, nunca cobra volta.** Mascote culpabilizador é
  mecânica predatória e está proibido (PG2). Ao retornar após semanas, o Fagulha comemora — não
  reclama.

---

## 6.12 Itens

| Categoria | Exemplos | Regra |
|---|---|---|
| **Cosméticos** | roupas, chapéus, cores, molduras | puramente estético |
| **Casa e Ilha** | móveis, plantas, construções, decoração | estético e criativo |
| **Montarias** | balão, planador, barco, criatura voadora | deslocamento no mapa; **não** acelera aprendizagem |
| **Ferramentas** | pincéis, instrumentos, peças, lupa | ampliam possibilidades **criativas**, não facilitam avaliação |
| **Narrativos** | Lupa de RELUZ, mapas antigos, chaves | abrem conteúdo e revelam mecânicas |
| **Cuidado** | alimento e brinquedo do Fagulha | vínculo, sem punição pela ausência |

**Nenhum item existe** que dê resposta, pule etapa, reduza dificuldade, garanta acerto ou compre
domínio. Isso não é uma decisão de balanceamento — é constitucional (PG9).

---

## 6.13 Sua Ilha (endgame)

No Tier **Lenda**, a criança funda a própria ilha, e a jornada muda de natureza: de restaurar o mundo
dos outros para construir o seu.

Ela recebe território, e nele constrói a casa, a feira (Prosperidade), o ateliê (Criatividade), a
oficina (Tecnologia), o museu (Descobertas), a horta (Vida) e o tabuleiro (Inteligência) — cada
construção desbloqueada pelo domínio na academia correspondente. Os Moradores restaurados ao longo
de toda a jornada mudam para lá. Os Colossos acordados aparecem no horizonte.

É um endgame infinito, criativo, sem competição, e é a resposta à pergunta "e depois que eu aprender
tudo?": **depois você constrói.**

---

## 6.14 Trilha de Luz (sequência de dias)

- Conta dias com pelo menos uma missão concluída, no fuso do responsável.
- **Lanternas:** a criança acumula 1 a cada 5 dias (máximo 2). Faltar um dia consome uma Lanterna em
  vez de zerar. Sem Lanterna, a trilha reinicia — mas **o recorde é preservado e exibido com
  orgulho**, nunca como perda.
- O responsável pode marcar **dias livres** (fim de semana, férias, viagem) que não interrompem nada.
- **Nenhum lembrete de sequência é enviado à criança** (PSI3). Se houver lembrete, vai ao adulto.
- Nenhuma mensagem de culpa, nenhuma contagem regressiva, nenhum "não perca sua sequência!".

**Justificativa:** a sequência é uma das mecânicas mais eficazes e mais abusadas do mercado. Mantemos
o benefício (hábito) e removemos cirurgicamente o dano (ansiedade e coerção). Uma criança de 8 anos
não deve sentir medo de decepcionar um aplicativo.

---

## 6.15 Conquistas e Medalhas

Quatro graus: Bronze, Prata, Ouro e Lendária. Distribuídas em cinco famílias, deliberadamente
equilibradas entre os quatro perfis de jogador (PG7):

| Família | Reconhece | Perfil atendido |
|---|---|---|
| **Domínio** | Faróis acesos, competências dominadas | Conquistador |
| **Persistência** | voltar depois de errar, vencer um Colosso após tentativas | todos |
| **Descoberta** | segredos, cantos escondidos, moradores raros | Explorador |
| **Criação** | obras, invenções, construções | Criador |
| **Cuidado** | ajudar personagens, missões em família, cuidar do Fagulha | Cuidador |

**A medalha mais rara do jogo não é de acerto.** É a *Medalha da Virada*: concedida quando a criança
volta a uma competência em que falhou repetidamente e a domina. Isso comunica, no nível mais alto
do sistema de recompensa, qual é o valor central da plataforma — persistir vale mais que acertar
de primeira (PP5).
