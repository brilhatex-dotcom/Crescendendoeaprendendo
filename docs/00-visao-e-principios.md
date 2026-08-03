# 00 — Visão do Produto e Princípios de Design

> Documento fundador. Todas as decisões técnicas dos documentos seguintes derivam daqui.
> Qualquer conflito entre um requisito técnico e um princípio deste documento é resolvido **a favor do princípio**.

---

## 1. Declaração de produto

**Crescendo e Aprendendo** é uma plataforma de desenvolvimento infantil onde a criança vive uma
aventura contínua em mundos temáticos ("Academias") e, ao jogar, desenvolve competências escolares
(BNCC), cognitivas, socioemocionais, tecnológicas, criativas e de vida.

A criança nunca vê uma "lista de exercícios". Ela vê um mapa, uma missão, um personagem que precisa
de ajuda, um chefão que só cai quando ela domina uma habilidade.

**Métrica-norte (North Star):** *minutos de aprendizagem com domínio comprovado por semana, por
criança* — não tempo de tela, não sessões, não cliques. A plataforma é explicitamente projetada
para **não** otimizar retenção compulsiva.

---

## 2. Público e escala etária

| Faixa | Nome interno (`AgeBand`) | Tom | Leitura exigida | Duração alvo de sessão |
|---|---|---|---|---|
| 6–8 anos | `SPROUT` | Narrativo, muita voz e ícone | Baixa (áudio sempre disponível) | 8–12 min |
| 9–12 anos | `EXPLORER` | Aventura, humor, desafio | Média | 12–20 min |
| 13–15 anos | `PIONEER` *(futuro)* | Menos infantil, mais estratégia/projeto | Alta | 20–30 min |
| 16–17 anos | `VANGUARD` *(futuro)* | Portfólio, autonomia, vida real | Alta | 25–40 min |

**Fase 1 entrega `SPROUT` e `EXPLORER`.** `PIONEER`/`VANGUARD` já existem como enum, como token de
tema, como filtro de conteúdo e como variação de copy desde o dia 1 — a expansão futura é
**cadastro de conteúdo + tema**, nunca refatoração de sistema (ver `10-escalabilidade.md §7`).

---

## 3. Os cinco princípios inegociáveis

### P1 — Aprender é a recompensa, não o pedágio
Nenhum mecanismo pode transformar aprendizagem em custo e diversão em prêmio. Não existe "faça 10
contas para liberar o jogo": a conta **é** o jogo. Consequência técnica: toda atividade tem
`intrinsicPlayValue` avaliado em revisão de conteúdo; atividades reprovadas não entram.

### P2 — Zero mecânicas predatórias
Proibidos por arquitetura (não por disciplina de time):
- Loot box paga, moeda premium comprável com dinheiro real, "pay-to-win".
- Energia que **bloqueia aprender**. Energia limita apenas *recompensa de repetição* (ver `08 §4`).
- Ranking público global por pontuação absoluta.
- Streak com punição ansiogênica (perda catastrófica, contagem regressiva agressiva).
- Notificação push com gatilho de culpa ("seu mascote está triste, volte!").

Estes itens estão listados como **testes automatizados de política** (`08 §12`), não apenas como texto.

### P3 — A criança nunca é rotulada
O Perfil de Talentos **sugere**, nunca restringe. Nenhuma tela mostra à criança um rótulo fixo
("você é o tipo matemático"). Nenhum conteúdo é ocultado por causa do perfil. O perfil é um
*viés de recomendação com teto*: no máximo 40% das sugestões de um dia podem vir do talento dominante.

### P4 — Erro é matéria-prima, não falha
A IA e o motor de avaliação **nunca** respondem apenas "errado". Toda resposta incorreta produz:
diagnóstico do equívoco (misconception), uma dica escalonada, e uma nova tentativa em contexto.
Contrato técnico: `EvaluationResult` **não compila** sem o campo `feedback.teaching` preenchido.

### P5 — Privacidade infantil acima de conveniência de produto
Criança não tem e-mail, não tem chat livre, não tem perfil público, não envia texto livre para
outra pessoa. Dados de criança são minimizados, pseudonimizados em analytics, e o responsável
tem exportação e exclusão reais (LGPD Art. 18). Detalhes em `09-autenticacao-e-privacidade.md`.

---

## 4. Pilares da experiência

1. **Mundo antes de menu.** A navegação primária é um mapa, não uma lista.
2. **Uma decisão por tela.** A criança nunca escolhe entre mais de 3 caminhos claros.
3. **Feedback em < 100 ms.** Toda ação toca, brilha ou soa imediatamente (otimista), a validação real vem depois.
4. **Progresso sempre visível.** Nada é perdido: sessão interrompida retoma exatamente no ponto.
5. **Beleza com contraste.** Glassmorphism e gradientes só onde não comprometem legibilidade AA (`05 §7`).
6. **Silêncio é opção.** Áudio, movimento e partículas são desligáveis por criança e por responsável.

Referências de linguagem visual/ritmo: Nintendo (clareza de affordance), Disney (personagem e arco
narrativo), Pokémon (coleção e progressão), Duolingo (loop curto e reforço), Khan Academy (mapa de
domínio real), Apple (contenção, tipografia, foco), Roblox/Minecraft (agência e construção).

---

## 5. Escopo por fase (resumo executivo)

| Fase | Nome | Conteúdo | Sistemas |
|---|---|---|---|
| **F1** | Fundação Jogável | Academia do Conhecimento (Português + Matemática, 6–10 anos) + Academia da Inteligência (5 jogos) | Auth, RPG core, motor de atividades, mapa, economia, painel dos pais, PWA |
| **F2** | Tutor e Expansão | Ciências, História, Geografia, Inglês; Academia da Vida | Tutor IA, adaptatividade, perfil de talentos, relatórios avançados |
| **F3** | Escolas | Todas as academias iniciais | Painel do professor, turmas, atribuições, multi-tenant escolar |
| **F4** | Criação | Academia da Tecnologia, Criatividade, Descobertas | Editor de conteúdo (CMS), UGC moderado, projetos em família |
| **F5** | Ampliação etária | Faixas 13–17 | Temas `PIONEER`/`VANGUARD`, trilhas de portfólio |

Cronograma detalhado e critérios de aceite em `11-roadmap.md`.

---

## 6. Convenções do repositório

- **Idioma do código:** inglês (identificadores, tipos, tabelas, rotas internas).
- **Idioma do produto e da documentação:** português do Brasil; i18n preparado desde o início (`en`, `es`).
- **Documentação:** decisões arquiteturais relevantes viram ADR em `docs/adr/NNNN-titulo.md`.
- **Sem código provisório:** nada de `TODO`, `FIXME`, mock em produção, ou função vazia "para depois".
  Lint proíbe (`no-warning-comments`). Funcionalidade não pronta não é mesclada — fica atrás de feature flag desligada.
