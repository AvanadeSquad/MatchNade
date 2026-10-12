# Backend

API REST em Node.js 20+ com Express 5. Os dados ficam em PostgreSQL; sem `DATABASE_URL` a API usa PGlite (PostgreSQL em processo), então roda sem instalar nada.

## Rodar

No PowerShell, a partir da raiz do repositório:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

A API sobe em http://localhost:3000/api/v1 já com 30 pessoas fictícias. Com `AUTH_DEV_LOGIN=true` (padrão do `.env.example`) a tela de login mostra uma lista de pessoas para entrar sem Google.

## Testes

```powershell
npm test
```

Os testes usam PGlite em memória e cobrem afinidade, IA (timeout, nova tentativa, disjuntor, saída inválida), autenticação, perfil, conexões, chat, bloqueio e as regras de cota e expiração.

## Medir o desempenho

```powershell
npm run medir
```

Cria 5 mil pessoas fictícias com 6 interesses cada (em PGlite, em memória) e mede a mediana e o p90 de 20 execuções da descoberta, da lista de conexões e do perfil de outra pessoa. Com `MEDIR_DATABASE_URL` mede num PostgreSQL vazio.

As três rotas carregam a base de perfis inteira para calcular a afinidade. A consulta busca uma linha por pessoa, com os ids das tags agregados, e o catálogo de tags à parte. Números medidos numa máquina de desenvolvimento:

| Rota | PGlite antes | PGlite depois | PostgreSQL 16 antes | PostgreSQL 16 depois |
|---|---|---|---|---|
| Descoberta | 340 ms | 83 ms | 53 ms | 42 ms |
| Lista de conexões | 349 ms | 82 ms | 78 ms | 39 ms |
| Perfil de outra pessoa | 363 ms | 87 ms | 59 ms | 43 ms |

## Estrutura

```
src/
  app.js           monta o Express (segurança, CORS, limite de requisições, rotas)
  index.js         inicia banco, dados de exemplo e servidor
  config/env.js    leitura e validação das variáveis de ambiente
  db/              schema.sql, conexão (pg ou PGlite) e dados de exemplo
  routes/          rotas HTTP e validação das entradas (zod)
  services/        regras de negócio (afinidade, conexões, chat, bloqueios, perfil)
  ai/              provedores (Gemini, Groq), prompts, disjuntor e serviço de IA
  middlewares/     autenticação e tratamento de erros
scripts/          medição de desempenho
test/              testes com vitest e supertest
```

## Regras que o código garante

- Cargo e senioridade nunca entram no cálculo de afinidade, nas recomendações, nas tags nem no texto da IA. O cargo só é devolvido nas conexões confirmadas e no perfil da pessoa depois do match.
- Mínimo de 3 interesses por perfil.
- Match só existe com interesse dos dois lados. O chat e o quebra-gelo só abrem para conexões aceitas e sem bloqueio.
- Cota semanal de solicitações (padrão 3, de 1 a 5), contada de segunda a domingo no horário de Brasília.
- Solicitações pendentes há mais de 14 dias expiram. Quem pediu pode pedir de novo.
- Uma recusa é permanente: se alguém tentar demonstrar interesse de novo em quem recusou, ou em quem foi recusado, a API devolve `409 JA_EXISTE`.
- A IA nunca bloqueia o fluxo: timeout de 2,5 s, uma nova tentativa após 500 ms, disjuntor (3 falhas em 60 s), prazo total de 8 s (dá tempo de o provedor reserva responder) e fallback para tags manuais e texto padrão.

## Variáveis de ambiente

Veja `.env.example`. Em produção a API recusa iniciar sem `JWT_SECRET` forte, `DATABASE_URL`, `GOOGLE_CLIENT_ID` e lista de e-mails liberados, e recusa `AUTH_DEV_LOGIN` e `E2E_TEST_MODE`.

A API completa está em `docs/api.md`.
