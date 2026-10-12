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

### Com PostgreSQL real

Com a variável `TEST_DATABASE_URL` os mesmos testes rodam em um PostgreSQL de verdade. Cada arquivo de teste cria um schema próprio, vazio, e o apaga no fim, então o banco pode ser compartilhado e os arquivos rodam em paralelo. O usuário precisa poder criar schemas no banco.

Com um PostgreSQL instalado na máquina (sem Docker), no PowerShell:

```powershell
psql -U postgres -c "CREATE USER teste WITH PASSWORD 'teste';"
psql -U postgres -c "CREATE DATABASE matchnade_teste OWNER teste;"
$env:TEST_DATABASE_URL = "postgresql://teste:teste@localhost:5432/matchnade_teste"
npm test
```

O arquivo `test/compatibilidade-banco.test.js` confere, nos dois bancos, os pontos em que pg e PGlite poderiam divergir: contagens e `bigint` como número (o pg devolveria texto sem o ajuste em `src/db/index.js`), `REAL`, `TIMESTAMPTZ` e `JSONB`, o índice único parcial do par, `ON CONFLICT` sobre `LOWER(name)` e a trava consultiva de transação.

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

## Variáveis de ambiente

Veja `.env.example`. Em produção a API recusa iniciar sem `JWT_SECRET` forte, `DATABASE_URL`, `GOOGLE_CLIENT_ID` e lista de e-mails liberados, e recusa `AUTH_DEV_LOGIN` e `E2E_TEST_MODE`.

A API completa está em `docs/api.md`.
