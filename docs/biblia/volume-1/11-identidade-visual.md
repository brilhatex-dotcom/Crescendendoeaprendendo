# Capítulo 11 — Identidade Visual e Sensorial

> **Bíblia Pedagógica · Volume 1 · Capítulo 11**
> Este capítulo define a *intenção* estética e emocional. A implementação em tokens, componentes e
> código está em `docs/05-design-system.md` (Design System **Aurora** — nome que homenageia
> Aurora Prima, o continente perdido do Capítulo 3).

---

## 11.1 A ideia visual central

> **Crescente é um mundo apagado que volta a ter luz — e é a criança quem acende.**

Toda decisão visual serve a essa frase. Cor, movimento e som existem para tornar visível o efeito da
aprendizagem sobre o mundo:

| Estado | Como se parece | Quando aparece |
|---|---|---|
| **Névoa** | dessaturado, contraste baixo, silêncio, movimento lento | conteúdo não explorado |
| **Faísca** | cor voltando por partes, som tímido, vida surgindo | durante a missão |
| **Aceso** | saturação plena, luz volumétrica, som ambiente rico, moradores | competência dominada |

**Consequência prática:** o mapa de progresso não precisa de barra de progresso. A criança vê a cor
voltando. Esta é a decisão de identidade mais importante da plataforma — ela transforma o dado
pedagógico em experiência estética.

---

## 11.2 Paleta

### Cores de marca
| Papel | Cor | Uso |
|---|---|---|
| Primária — **Violeta Aurora** | `#7C5CFF` | identidade, Luz/XP, ações principais |
| Secundária — **Turquesa Corrente** | `#22D3EE` | progresso, dicas, o Fagulha |
| Acento — **Âmbar Fagulha** | `#FFB020` | moedas, recompensa, destaque |
| Sucesso — **Verde Folha** | `#34D399` | acerto, domínio, vida voltando |
| Atenção — **Coral** | `#FB7185` | o "quase" — **nunca** vermelho agressivo |
| Névoa | `#6B7280` dessaturado | o não explorado |
| Fundo profundo | `#0B0620` | o Grande Vazio, base do modo `play` |

**Decisão pedagógica sobre o vermelho:** feedback de erro usa coral, com ícone e microtexto de
apoio. Vermelho saturado com "X" ativa resposta de ameaça, aumenta ansiedade e piora a retenção
infantil. Não é preferência estética — é consequência de PP5.

### Cores das sete Academias
Cada ilha tem gradiente próprio. Trocar de ilha troca apenas três variáveis (`--academy-from`,
`--academy-to`, `--academy-glow`); nenhum componente conhece nomes de academia.

| Academia | Ilha | Gradiente | Sensação buscada |
|---|---|---|---|
| Conhecimento | Mil Perguntas | `#4F46E5 → #22D3EE` | clareza, amplitude, manhã |
| Inteligência | dos Nós | `#7C5CFF → #EC4899` | mistério, engenho, noite |
| Vida | do Vilarejo | `#10B981 → #84CC16` | acolhimento, crescimento, horta |
| Tecnologia | Engrena | `#06B6D4 → #3B82F6` | energia, precisão, oficina |
| Criatividade | Aquarela | `#FB923C → #F472B6` | liberdade, calor, tinta |
| Descobertas | Errante | `#14B8A6 → #FDE047` | horizonte, aventura, sol no mar |
| **Prosperidade** | **Pontal** | `#D97706 → #FBBF24` | **terra, madeira, feira, confiança** |

A Prosperidade recebe a paleta mais "terrena" de propósito: madeira, cobre, âmbar. Prosperidade em
Crescente é construção e trabalho — nunca ouro cintilante, nunca estética de riqueza. Isso vacina o
capítulo mais sensível contra o tom de ostentação (limites do Capítulo 5).

### Regras invioláveis de cor
1. Contraste mínimo AA (4.5:1 texto normal, 3:1 texto grande e componentes) — verificado em build.
2. **Glassmorphism jamais carrega texto sozinho**: todo painel de vidro tem camada sólida atrás do
   texto. Beleza nunca vence legibilidade.
3. Nenhuma informação transmitida só por cor — sempre com ícone, forma e texto.
4. Paleta validada para deuteranopia, protanopia e tritanopia.

---

## 11.3 Tipografia

| Papel | Fonte | Por quê |
|---|---|---|
| Display / mundo | **Baloo 2** | arredondada, alegre, com peso — títulos de missão e números de Luz |
| Interface | **Nunito** | legibilidade excelente em corpo pequeno, formas abertas, tom amigável |
| Dados | **JetBrains Mono** | relatórios numéricos e Academia da Tecnologia |
| Acessível | **Atkinson Hyperlegible** | opção para dislexia, ativável por criança |

Corpo mínimo de **20 px** para 6–8 anos, com entrelinha 1.6 — requisito de legibilidade infantil,
não escolha estética. A escala tipográfica muda por faixa etária: o mesmo componente respira
diferente para 7 e para 12 anos.

**Regra de texto:** frases curtas, voz ativa, verbos concretos. Nenhuma instrução essencial existe
apenas em texto — sempre com áudio e ícone (V6).

---

## 11.4 Emoções que cada superfície transmite

| Superfície | Emoção-alvo | Como se consegue | O que evitamos |
|---|---|---|---|
| Hub / casa | *"cheguei em casa"* | luz quente, o Fagulha reagindo, som ambiente calmo | urgência, lista de pendências, alerta |
| Mapa | *"olha quanta coisa"* | profundidade, névoa ao longe, segredos visíveis | densidade de menu, texto sobrando |
| Missão | *"foco"* | tela limpa, sem navegação, uma decisão por vez | HUD poluído, distração, cronômetro |
| Acerto | *"eu consegui"* | partícula, som, o mundo ganhando cor | fanfarra idêntica para tudo |
| Erro | *"ah, quase — deixa eu ver"* | coral suave, movimento pequeno, personagem calmo | vermelho, buzina, tremor, "X" |
| Colosso | *"isso é grande"* | escala, câmera afastada, música com tema próprio | ameaça, medo, violência |
| Recompensa | *"valeu a pena"* | luz explodindo, item girando, coleção preenchendo | tela cheia de números |
| Pausa | *"foi bom, até amanhã"* | Fagulha se acomodando, luz baixando | porta batendo, cadeado, cobrança |
| Painel dos pais | *"eu entendi, tá tudo bem"* | claro, calmo, tipografia respirada | dashboard corporativo, gráfico enigmático |
| Painel do professor | *"achei o que preciso"* | densidade alta, zero decoração | infantilização do adulto |

---

## 11.5 Ilustração

**Estilo:** ilustração vetorial com textura — formas cheias e arredondadas, contorno variável, luz
como elemento gráfico (halo, raio, partícula). Referências de sensação: a clareza de silhueta da
Nintendo, o desenho de personagem da Disney, a paleta de céu do Studio Ghibli.

**Regras vinculantes:**
1. **Silhueta legível em 24 px.** Todo personagem e ícone é reconhecível pela forma, sem detalhe.
2. **Nada realista.** Realismo em conteúdo infantil envelhece rápido e assusta.
3. **Sem violência, sem armas, sem sangue, sem morte** — nem estilizados. A cosmologia já elimina a
   necessidade (Apagados são lembrados, não destruídos).
4. **Diversidade real** em cor de pele, corpo, cabelo, idade e deficiência (R5, Capítulo 7).
5. **Ambiente antes do personagem:** o mundo conta a história. Uma ilha apagada precisa dar um aperto
   no peito antes de qualquer diálogo.
6. **Sem texto embutido em imagem** — impede localização e acessibilidade.

---

## 11.6 Animação

| Tipo | Duração | Sensação |
|---|---|---|
| Toque | 80 ms | resposta imediata (é o que faz a interface parecer "viva") |
| Seleção/hover | 160 ms | atenção |
| Entrada de elemento | 260 ms | ordem |
| Recompensa | 420 ms, elástica | celebração |
| Transição de mundo | 650 ms | cinema |

**Princípios:** tudo é interrompível; nada acima de 700 ms bloqueia interação; movimento sempre tem
significado (mostra origem, destino ou consequência) — animação decorativa que compete com a
instrução é removida (PP7).

**Movimento reduzido:** com `prefers-reduced-motion` ou ajuste da criança, translação e escala viram
*fade* de 120 ms. **O feedback nunca desaparece — só o deslocamento.** Acessibilidade não pode custar
a informação.

**Personagens:** animação de *idle* obrigatória (personagem parado é personagem morto), reação a
acerto e erro, e uma animação de "pensando" — porque a criança precisa ver o tutor pensando para
entender que pensar leva tempo.

---

## 11.7 Som

Som é metade da sensação de qualidade AAA e a primeira coisa cortada em produtos medianos.

| Camada | Função |
|---|---|
| **Ambiente por ilha** | cada uma tem sua paisagem sonora (papel e vento; engrenagem e vapor; feira e martelo; mar e gaivota) |
| **Música** | tema por academia, variação por região, tema próprio de Colosso; instrumentação brasileira sempre presente |
| **Interface** | toque, seleção, abrir, fechar — curtos, suaves, nunca estridentes |
| **Feedback** | acerto (acorde ascendente), "quase" (nota neutra descendente — **jamais** buzina), recompensa (arpejo), Farol aceso (tema completo) |
| **Voz** | narração das instruções e falas dos personagens, em pt-BR com sotaques regionais |
| **Fagulha** | vocalizações próprias, não linguagem — como um bichinho |

**Regras:** nunca há música com letra durante leitura ou cálculo (PP7); todo áudio é desligável e
funciona offline; nada de som de erro punitivo; e **volume dinâmico** — a trilha abaixa durante a
instrução falada.

---

## 11.8 Microinterações

São elas que separam "site educativo" de "produto que a criança ama". Padrão obrigatório:

- Todo elemento tocável responde em **≤ 100 ms**, mesmo antes da validação do servidor.
- Botões afundam levemente; cartas inclinam com o toque; itens giram ao serem obtidos.
- Números sobem contando (Luz e moedas), nunca aparecem prontos.
- A barra de Luz **passa um pouco do alvo e volta** — o excesso mínimo é o que dá sensação de peso.
- O Fagulha reage a tudo: acerto, erro, hesitação longa, retorno depois de dias.
- Vazio nunca é vazio: toda tela sem conteúdo tem ilustração, explicação e uma saída.
- Carregamento nunca é um giro anônimo: é o mundo se montando, com dica de jogo ou fala de personagem.
- **Erro de toque não pune:** tocar fora do alvo não conta como resposta errada. Motricidade em
  desenvolvimento não pode virar erro pedagógico.

---

## 11.9 Tom de comunicação

### Com a criança
Caloroso, direto, respeitoso, com humor. Segunda pessoa. Frases curtas. **Nunca infantilizado** —
crianças de 10 anos percebem condescendência instantaneamente e desprezam o produto.

| Nunca dizer | Dizer |
|---|---|
| "Resposta incorreta" | "Ainda não. Olha aqui." |
| "Muito bem, campeão!" | "Você mudou de estratégia. Foi isso que funcionou." |
| "Você falhou" | "Esse aí é osso. Bora de novo." |
| "Você precisa estudar mais" | *(nunca; a palavra "estudar" não existe no mundo)* |
| "Nível fácil" | *(nunca; a criança jamais vê rebaixamento)* |

### Com o responsável
Adulto, honesto, direto, sem jargão e sem alarme. Evidência antes de opinião. Uma sugestão por vez.
Nunca vender dentro de conteúdo pedagógico.

### Com o professor
Profissional, denso, respeitoso da expertise. "Sugerimos", nunca "o sistema determinou". Nada que
avalie o docente.

### Em marketing
**Não prometemos o que não medimos** (V2). Proibido: "aprova no colégio", "seu filho 2 anos à
frente", "comprovado cientificamente" sem estudo público, ou qualquer peça que use culpa parental
como gatilho. Vendemos o que somos — e é o bastante.

---

## 11.10 Marca

**Nome do produto:** Crescendo e Aprendendo. **Nome do universo:** Crescente.

**Símbolo:** uma **faísca dentro de um crescente** — a lua crescente e a chama recém-acesa na mesma
forma. Funciona em 16 px, em uma cor, bordado, gravado e em ícone maskable de PWA.

**Assinatura verbal:**
> *"Toda criança acende. É só ter quem pergunte junto."*

**O que a marca nunca faz:** usar criança real em situação de vulnerabilidade em publicidade;
prometer resultado escolar; usar medo ("seu filho está atrasado"); comparar crianças; ou aparecer em
qualquer contexto que venda atenção infantil.
