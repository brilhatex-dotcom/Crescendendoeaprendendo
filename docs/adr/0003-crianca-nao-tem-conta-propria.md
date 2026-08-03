# ADR 0003 — Criança não possui conta própria

- **Status:** Aceito
- **Data:** 2026-08-03

## Contexto

Autenticar menores de 13 anos cria risco jurídico (LGPD Art. 14, COPPA, GDPR-K), risco de segurança
(recuperação de senha por dados pessoais, engenharia social) e atrito de produto (criança de 6 anos
não gerencia senha nem e-mail).

## Decisão

`Learner` é um **perfil** dentro da conta de um adulto (`Account` + `GuardianLink`), ou dentro de uma
`Organization` escolar com consentimento registrado. O acesso da criança se dá por uma **sub-sessão
derivada** da sessão adulta, com escopo reduzido (`play:*`), validade de 4 horas, e saída protegida
por PIN do responsável. No contexto escolar, o acesso usa código de turma + código pessoal
não-identificável, com validade limitada ao turno.

## Consequências

- **Positivas:** consentimento parental é estruturalmente garantido (não existe criança sem
  responsável vinculado); minimização de dados por construção (apelido + ano de nascimento);
  superfície de ataque sobre menores drasticamente reduzida; exclusão LGPD é operação simples e
  completa.
- **Custo aceito:** o fluxo de entrada tem um passo a mais (seletor de perfis) e o compartilhamento
  de dispositivo entre irmãos exige troca explícita de perfil — comportamento desejável, pois evita
  atribuição de progresso à criança errada.
- **Implicação técnica:** toda autorização é verificada no caso de uso via `LearnerAccessGuard`;
  o middleware é apenas a primeira barreira, nunca a única.
