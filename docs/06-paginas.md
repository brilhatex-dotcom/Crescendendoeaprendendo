# 06 — Mapa de Páginas e Rotas

Legenda de renderização: **S** estático/ISR · **R** RSC dinâmico · **C** ilha cliente ·
**St** streaming com Suspense.
Legenda de acesso: 🌐 público · 👤 adulto autenticado · 🧒 sessão de criança · 🎓 professor · 🛡️ admin.

## 1. Marketing (🌐, S)

| Rota | Página | Notas |
|---|---|---|
| `/` | Landing | herói animado, prova social, CTA duplo (família/escola). SEO prioritário |
| `/para-pais` | Proposta para famílias | segurança, LGPD, resultados |
| `/para-escolas` | Proposta B2B | BNCC, painel do professor, contato comercial |
| `/academias` | Vitrine das 6 academias | SEO de cauda longa por academia |
| `/academias/[slug]` | Detalhe da academia | conteúdo gerado do banco, ISR |
| `/precos` | Planos | |
| `/seguranca` · `/privacidade` · `/termos` | Confiança e legal | versionadas, ligadas ao `Consent.version` |
| `/ajuda` · `/ajuda/[artigo]` | Central de ajuda | busca estática |

## 2. Autenticação (🌐, R + C)

| Rota | Função |
|---|---|
| `/entrar` | e-mail+senha, Google, Apple |
| `/criar-conta` | conta do responsável (nunca da criança) |
| `/criar-conta/escola` | fluxo B2B com validação de domínio |
| `/verificar-email` | verificação obrigatória antes de criar criança |
| `/recuperar` · `/redefinir` | reset com token de uso único |
| `/convite/[token]` | co-responsável ou professor convidado |

## 3. Família / Responsável (👤)

| Rota | Página | Render |
|---|---|---|
| `/familia` | **Seletor de perfis** — porta de entrada pós-login | R |
| `/familia/nova-crianca` | Criação de perfil (apelido, ano de nascimento, avatar, acessibilidade) | R+C |
| `/painel` | Visão geral da semana por criança | R+St |
| `/painel/[learnerId]` | Painel individual: tempo, domínio, humor, sequência | R+St |
| `/painel/[learnerId]/relatorios` | Relatórios por competência com evidências | R+St |
| `/painel/[learnerId]/relatorios/[periodo]` | Relatório fechado (mensal/bimestral), exportável em PDF | R |
| `/painel/[learnerId]/tempo` | Limites diários, janelas de horário, pausa forçada gentil | R+C |
| `/painel/[learnerId]/conteudo` | Academias liberadas, tutor IA on/off, tipos de atividade | R+C |
| `/painel/[learnerId]/tutor` | Transcrições do tutor (transparência total) | R |
| `/painel/[learnerId]/metas` | Metas e missões em família | R+C |
| `/painel/notificacoes` | Preferências e histórico | R |
| `/conta` | Perfil, senha, MFA, PIN | R+C |
| `/conta/privacidade` | Exportar dados, excluir criança, revogar consentimento | R+C |
| `/conta/assinatura` | Plano e faturamento | R |

## 4. Experiência da criança (🧒) — `(play)`

| Rota | Página | Render | Notas |
|---|---|---|---|
| `/hub` | Base/casa: mascote, missão do dia, sequência, atalhos | R+C | tela mais visitada — orçamento de performance mais rígido |
| `/academias` | Mapa-mãe das 6 academias | R+C | |
| `/a/[academy]` | Mundo da academia: mapa de regiões | R+C | dados de mapa em cache por tag |
| `/a/[academy]/[world]` | Mapa de nós (capítulos/missões) | R+C | progresso em stream |
| `/missao/[questId]` | **Sessão de jogo** — fullscreen, sem HUD de navegação | C | dados iniciais via RSC; sem navegação acidental |
| `/missao/[questId]/resultado` | Recompensas, domínio, próximo passo | R+C | |
| `/tutor` | Tutor IA (chat guiado, sugestões prontas, voz) | C+stream | |
| `/colecoes` | Conquistas, medalhas, coleções | R | |
| `/colecoes/[tipo]` | Detalhe (medalhas, veículos, itens, cartas) | R | |
| `/mascote` | Mascote: evolução, afinidade, customização | R+C | |
| `/casa` | Casa personalizável (itens equipados) | C | |
| `/loja` | Loja com moedas/cristais/diamantes | R+C | sem compra com dinheiro real na conta da criança |
| `/perfil` | Nível, tier, estatísticas, avatar | R+C | |
| `/desafios` | Desafios diários/semanais e eventos | R | |
| `/pausa` | Tela de pausa gentil ao atingir limite de tempo | R | tom acolhedor, sugere atividade offline |

## 5. Professor (🎓) — `(teacher)`

| Rota | Página |
|---|---|
| `/turmas` | Lista de turmas |
| `/turmas/nova` | Criação + código de entrada |
| `/turmas/[id]` | Visão da turma: domínio agregado, alertas |
| `/turmas/[id]/alunos` | Lista, progresso individual |
| `/turmas/[id]/alunos/[learnerId]` | Ficha do aluno |
| `/turmas/[id]/atividades` | Atribuições, prazos, correção |
| `/turmas/[id]/atividades/nova` | Montagem de missão a partir de competências (com sugestão da IA) |
| `/turmas/[id]/relatorios` | Cobertura BNCC, evolução, exportação |
| `/turmas/[id]/ranking` | Ranking saudável (esforço/evolução, por turma, opt-in) |
| `/turmas/[id]/comunicacao` | Recados para responsáveis (moderado, sem contato com criança) |
| `/planos` | Sugestões de plano de aula geradas por IA a partir de lacunas reais |

## 6. Admin / Conteúdo (🛡️) — `(admin)`

| Rota | Página |
|---|---|
| `/admin/conteudo` | Pacotes, status, cobertura curricular |
| `/admin/conteudo/atividades` | Busca, filtro por tipo/dificuldade/origem |
| `/admin/conteudo/atividades/[id]` | Editor + pré-visualização real do plugin |
| `/admin/conteudo/revisao` | Fila de revisão pedagógica (inclui amostragem de conteúdo de IA) |
| `/admin/curriculo` | Árvore de competências e DAG de pré-requisitos |
| `/admin/mundos` | Editor de mapa, missões, chefões, recompensas |
| `/admin/economia` | Balanceamento de XP/moedas, simulador de progressão |
| `/admin/flags` | Feature flags e rollout |
| `/admin/moderacao` | Conteúdo sinalizado, transcrições marcadas |
| `/admin/auditoria` | Consulta de `AuditLog` |
| `/admin/saude` | Filas, jobs, erros, custo de IA |

## 7. Sistema

`/api/auth/[...nextauth]` · `/api/tutor/stream` · `/api/jobs/[job]` (HMAC) · `/api/uploads/sign` ·
`/api/health` · `/manifest.webmanifest` · `/sitemap.xml` · `/robots.txt` · `/offline` ·
`not-found` · `global-error`.

## 8. Regras de navegação

1. **A criança não vê rota adulta.** Middleware bloqueia `(guardian)`/`(teacher)`/`(admin)` sob
   sessão de criança e vice-versa — não é só ocultar link.
2. `/missao/[questId]` é **modo foco**: sem menu, sem loja, sem notificação; saída pede confirmação.
3. Voltar do navegador nunca perde progresso: estado da etapa é persistido a cada resposta.
4. Deep link para missão bloqueada redireciona ao mapa com explicação do caminho (nunca erro 403 seco).
5. Toda rota `(play)` funciona em modo retrato **e** paisagem; missões que exigem paisagem avisam antes.
