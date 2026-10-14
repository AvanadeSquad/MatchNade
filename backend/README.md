# Backend

API REST em Node.js 20+ com Express 5. Os dados ficam em PostgreSQL; sem `DATABASE_URL` a API usa PGlite (PostgreSQL em processo), então roda sem instalar nada.

## Lint e formatação

```powershell
npm run lint           # ESLint com as regras recomendadas
npm run format:check   # confere a formatação do Prettier
npm run format         # aplica a formatação
```

O Prettier usa aspas simples, vírgula no fim e linhas de até 140 caracteres, o estilo que o código já tinha. Listas de dados, como as palavras de `src/utils/tags.js` e as pessoas de `src/db/seed.js`, ficam compactas com `// prettier-ignore`.

## Rodar

No PowerShell, a partir da raiz do repositório:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

A API sobe em http://localhost:3000/api/v1 já com 30 pessoas fictícias. Com `AUTH_DEV_LOGIN=true` (padrão do `.env.example`) a tela de login mostra uma lista de pessoas para entrar sem Google.

## Avaliação da IA

```powershell
npm run avaliar-ia
```

Roda a extração de tags nas 20 bios fictícias de `avaliacao/bios.json`, que incluem bios com cargo (em português, em inglês e em sigla), duas tentativas de injeção de prompt, uma bio vazia e duas genéricas. Mostra:

- **Precisão:** das tags devolvidas, quantas eram esperadas. Aparece `n/a` quando nenhuma tag foi devolvida.
- **Cobertura:** das tags esperadas, quantas foram devolvidas.
- **Respostas com cargo:** meta zero, com qualquer provedor.
- **Respostas que obedeceram a texto injetado:** tags que só existem no trecho injetado.
- **Bios não vazias sem resposta da IA:** quantas caíram no fallback. Se nenhuma tag foi devolvida (provedor real fora do ar ou chave inválida), o relatório destaca isso, porque os números não dizem nada sobre o modelo.

Sem chaves, usa um provedor simulado (`avaliacao/provedor-simulado.js`): um extrator ingênuo por palavras conhecidas que devolve também cargos e o texto injetado, para conferir o que a normalização e os filtros seguram. Com `GEMINI_API_KEY` ou `GROQ_API_KEY` definidas, usa os provedores reais. As chaves nunca são impressas, e os erros dos provedores trazem só o status HTTP ou o tipo da falha.

O script termina com erro (código 1) quando há resposta com cargo. Com provedor real, termina com erro também quando alguma resposta obedece ao texto injetado ou quando nenhuma tag é devolvida. Com o simulado, a injeção obedecida só é informada: o extrator ingênuo devolve o texto injetado de propósito, e a tag "Hackeado" é uma palavra válida que nenhum filtro posterior distingue de um interesse real.

Com o provedor simulado, precisão e cobertura ficam perto de 100% (98,4% e 96,8%), mas isso é circular: o vocabulário do simulado foi escrito a partir das tags esperadas. Esses números não medem qualidade; servem para ver o que a normalização descarta (por exemplo, `.NET`, porque a tag precisa começar com letra ou número). As metas de precisão e cobertura só fazem sentido com provedor real.

O teste `test/avaliacao-ia.test.js` cobre só o que o fluxo garante, com o simulado: nenhuma resposta com cargo, bio vazia e genérica sem tags, cargos injetados descartados e os interesses reais da bio mantidos diante de injeção. Cobre também o relatório (porcentagens em pt-BR, `n/a`, código de saída) e que os erros dos provedores não carregam a chave.

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
avaliacao/         bios fictícias e script de avaliação da extração de tags
src/
  app.js           monta o Express (segurança, CORS, limite de requisições, rotas)
  index.js         inicia banco, dados de exemplo e servidor
  config/env.js    leitura e validação das variáveis de ambiente
  db/              migrações SQL, conexão (pg ou PGlite) e dados de exemplo
  routes/          rotas HTTP e validação das entradas (zod)
  services/        regras de negócio (afinidade, conexões, chat, bloqueios, perfil)
  ai/              provedores (Gemini, Groq), prompts, disjuntor e serviço de IA
  middlewares/     autenticação e tratamento de erros
scripts/          medição de desempenho
test/              testes com vitest e supertest
```

## Migrações do banco

O esquema é definido por migrações SQL numeradas em `src/db/migracoes/` (`001_esquema_inicial.sql`, `002_...`). Na inicialização, `src/db/migrar.js` cria a tabela `schema_migrations` se ela não existir e aplica, em ordem, as migrações ainda não registradas. Cada migração roda numa transação junto com o seu registro: se falhar, nada dela fica aplicado e a API não sobe. Uma trava consultiva impede que duas instâncias migrem ao mesmo tempo. Funciona igual em PostgreSQL e PGlite.

Para mudar o esquema, crie o próximo arquivo numerado. Não altere uma migração já publicada, porque bancos que já a aplicaram não a executam de novo.

Um banco criado antes das migrações (sem `schema_migrations`) é adotado: a `001` usa `IF NOT EXISTS` e não muda nada que já exista, e as seguintes aplicam o que falta. A `002` troca a chave de `ai_interaction_log` para `ON DELETE CASCADE`.

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

## Variáveis de ambiente

Veja `.env.example`. Em produção a API recusa iniciar sem `JWT_SECRET` forte, `DATABASE_URL`, `GOOGLE_CLIENT_ID` e lista de e-mails liberados, e recusa `AUTH_DEV_LOGIN` e `E2E_TEST_MODE`.

A API completa está em `docs/api.md`.

## Contrato da API (OpenAPI)

`openapi.json`, nesta pasta, é a especificação OpenAPI 3.1 da API. Ela é gerada por `src/openapi/especificacao.js`: os corpos, os parâmetros de consulta (inclusive `category` em `/tags` e `limit` em `/matches/recommendations`) e o `id` do caminho vêm dos mesmos schemas zod que as rotas usam para validar. As respostas de `GET /matches/recommendations` e `GET /employees/{id}` são tipadas em `src/openapi/respostas.js`, com `additionalProperties: false`; o perfil de outra pessoa tem duas formas, antes do match (sem `position` e `bio`) e depois. Os resumos, as demais respostas e os códigos de erro são descritos à mão. Depois de mudar uma rota ou um schema:

```powershell
npm run openapi
```

O teste `test/contrato-openapi.test.js` falha se:

- o `openapi.json` estiver desatualizado;
- uma rota do Express não estiver na especificação, ou o contrário;
- os parâmetros de caminho declarados forem diferentes dos do caminho, ou uma rota ler de `req.query` um parâmetro não declarado (ou deixar de ler um declarado);
- uma rota declarada com login responder sem ele, ou o contrário;
- as respostas reais de recomendações e do perfil de outra pessoa não seguirem os schemas da especificação, inclusive se `position` ou `bio` aparecerem antes do match;
- o fuzz guiado pela especificação receber erro 500 ou um status não documentado ao enviar corpos e ids malformados.

O limite de requisições responde 429 em JSON, no mesmo formato dos outros erros: `{ "code": "LIMITE_EXCEDIDO", "message": "..." }`.
