# ADR 0004 — Sessão própria em vez de Auth.js na Etapa 0

- **Status:** Aceito
- **Data:** 2026-08-03
- **Substitui:** o item 4 do plano de autenticação em `docs/HANDOFF.md` §5
  ("Auth.js v5 com adaptador Prisma customizado")

## Contexto

O planejamento previa Auth.js v5 com um adaptador Prisma customizado. Ao implementar, o
descompasso entre o que o Auth.js espera e o que `prisma/schema.prisma` define ficou grande
demais para ser adaptado sem perder função:

| O que o schema define | O que o adaptador do Auth.js espera |
|---|---|
| `Session.tokenHash` (guardamos só o hash) | `sessionToken` em claro na coluna |
| `Session.activeLearnerId` | não existe — o modelo não tem conceito de sub-sessão |
| `Session.ipHash`, `userAgent`, `revokedAt` | não existem no contrato do adaptador |
| `Account` de domínio, `OAuthAccount` separado | `User` + `Account`, com esses nomes |
| `AccountStatus` com `PENDING_VERIFICATION` | `emailVerified` como data solta |

O contrato `Adapter` do Auth.js recebe e devolve o token de sessão em claro. Guardar apenas o
hash — exigência de `docs/09 §5`, "hash de token no banco" — não é configurável ali: seria
preciso interceptar cada método do adaptador e reimplementar a leitura, o que significa
escrever a camada de sessão mesmo assim, só que escondida atrás de uma API que trabalha contra
o objetivo.

A sub-sessão de criança agrava: ela não é um segundo login, é um **escopo reduzido dentro da
sessão adulta** (ADR 0003). O Auth.js não tem esse conceito, e emulá-lo com duas sessões
paralelas quebraria a propriedade que faz o desenho funcionar — sair da área infantil devolve
o adulto à sessão dele, sem novo login.

## Decisão

A sessão é **primeira parte**, implementada em `src/modules/identity` sobre os modelos que já
existem no schema:

- token opaco de 256 bits, gerado por `randomBytes`, guardado **em hash SHA-256**;
- sessão adulta em cookie `__Host-` `HttpOnly` `Secure` `SameSite=Lax`, 30 dias;
- sub-sessão de criança em cookie próprio, carga assinada com HMAC (`{ sessionId, learnerId, exp }`),
  4 horas, validada contra `Session.activeLearnerId` a cada requisição;
- senha e PIN com Argon2id (`@node-rs/argon2`), parâmetros do OWASP.

`OAuthAccount` permanece no schema, intocado, para quando Google/Apple entrarem.

## Consequências

- **Positivas:** o hash-em-repouso do token de sessão passa a ser propriedade do desenho, não
  um remendo; a sub-sessão de criança é expressa diretamente; revogação de sessão, lista de
  sessões ativas e `ipHash` pseudonimizado saem de graça, porque as colunas já existiam;
  nenhuma dependência nova além do Argon2.
- **Custo aceito:** somos responsáveis por código de segurança que uma biblioteca madura já
  teria revisado. Mitigação: o comportamento sensível está coberto por teste — resposta
  idêntica para e-mail inexistente e senha errada, `fakeVerify` com o mesmo custo de CPU,
  token de uso único, expiração, revogação, isolamento entre famílias (ver
  `src/modules/identity/application/identity.test.ts` e `tests/integration/`).
- **Quando OAuth entrar:** Auth.js pode voltar **apenas como provedor de OAuth**, gravando em
  `OAuthAccount` e delegando a criação de sessão para o caso de uso `entrar`. O que não volta é
  o adaptador de sessão.
- **Reversibilidade:** média. Os casos de uso dependem das portas `SessionRepository` e
  `AccountRepository`, não do mecanismo — trocar a implementação não toca em regra de negócio.
