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

## Logs e verificação de saúde

A API escreve uma linha JSON por evento na saída padrão, com `time`, `level` e `msg`. Cada requisição recebe um id: ele volta no cabeçalho `X-Request-Id` e aparece no campo `request_id` da linha registrada ao fim da requisição, junto com método, caminho sem a query string, status, duração em milissegundos e o id da pessoa logada. Se quem chamou já mandou um `X-Request-Id` com 8 a 64 letras, números ou hifens, ele é aproveitado.

Os logs nunca trazem corpo de requisição, token, e-mail, bio ou mensagens do chat. Erros inesperados são registrados com nome, código e pilha, sem a mensagem, porque erros do banco podem conter valores dos dados.

O nível vem de `LOG_LEVEL` (`debug`, `info`, `warn`, `error` ou `silent`). O padrão é `info`, e `silent` nos testes.

| Rota | Resposta |
|---|---|
| `GET /health` e `GET /api/v1/health` | `200 {"status":"ok"}` quando o processo responde |
| `GET /api/v1/health/ready` | `200 {"status":"ok","banco":"ok"}` quando o banco responde em até 2 segundos; senão `503 {"status":"indisponivel","banco":"erro"}` |

A prontidão não exige login, então o resultado fica guardado por 5 segundos (2 segundos quando o banco falha, para a recuperação aparecer logo), chamadas simultâneas aproveitam a mesma consulta, e a rota aceita até 120 requisições por minuto por IP. As requisições às rotas de saúde são registradas em `debug`, não em `info`.

## Variáveis de ambiente

Veja `.env.example`. Em produção a API recusa iniciar sem `JWT_SECRET` forte, `DATABASE_URL`, `GOOGLE_CLIENT_ID` e lista de e-mails liberados, e recusa `AUTH_DEV_LOGIN` e `E2E_TEST_MODE`.

A API completa está em `docs/api.md`.
